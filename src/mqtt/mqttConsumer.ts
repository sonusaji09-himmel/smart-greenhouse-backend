import { env } from '../config/env';
import { logger } from '../config/logger';
import { sensorIngestionService } from '../api/v1/services/sensorIngestion.service';
import { sensorReadingSchema } from '../api/v1/validators/sensor.validator';
import { connectMqtt, getMqttClient } from './mqttClient';
import { parseDeviceIdFromTopic } from './topics';

/**
 * Boots the MQTT pipeline:
 *   1. Opens a resilient client (auto-reconnect, persistent session).
 *   2. Subscribes to the telemetry wildcard topic with the configured QoS.
 *   3. Routes every incoming message through Zod validation and into the
 *      ingestion service.
 *
 * Failures at any step are logged but never crash the process — the broker
 * and backend are independent subsystems and the API must stay up even if
 * the broker is momentarily unreachable.
 */
export const startMqttConsumer = async (): Promise<void> => {
  const client = await connectMqtt();

  const qos = env.MQTT_QOS as 0 | 1 | 2;

  // Subscribe immediately; `resubscribe: true` re-applies this on reconnect.
  client.subscribe(env.MQTT_SUBSCRIBE_TOPIC, { qos }, (error, granted) => {
    if (error) {
      logger.error('MQTT subscribe failed', {
        topic: env.MQTT_SUBSCRIBE_TOPIC,
        error: error.message,
      });
      return;
    }
    logger.info(
      `MQTT subscribed → ${
        granted?.map((g) => `${g.topic}@QoS${g.qos}`).join(', ') ?? env.MQTT_SUBSCRIBE_TOPIC
      }`,
    );
  });

  client.on('message', (topic, payload) => {
    void handleMessage(topic, payload);
  });
};

/**
 * Parses and ingests a single MQTT telemetry message.
 *
 * We intentionally swallow per-message errors here: a malformed payload
 * from one device must never stop us consuming the next message. Each
 * failure is logged with full context for operational triage.
 */
const handleMessage = async (topic: string, payload: Buffer): Promise<void> => {
  const deviceIdFromTopic = parseDeviceIdFromTopic(topic);

  let raw: unknown;
  try {
    raw = JSON.parse(payload.toString('utf8'));
  } catch (error) {
    logger.warn('MQTT payload is not valid JSON', {
      topic,
      size: payload.length,
      error: (error as Error).message,
    });
    return;
  }

  if (raw && typeof raw === 'object' && deviceIdFromTopic) {
    (raw as Record<string, unknown>).deviceId ??= deviceIdFromTopic;
  }

  const parsed = sensorReadingSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('MQTT payload failed validation', {
      topic,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  try {
    const result = await sensorIngestionService.ingest(parsed.data);
    logger.debug('MQTT message ingested', {
      topic,
      deviceId: result.deviceId,
      recordedAt: result.recordedAt.toISOString(),
      deduplicated: result.deduplicated,
    });
  } catch (error) {
    logger.error('Failed to ingest MQTT message', {
      topic,
      deviceId: parsed.data.deviceId,
      error: (error as Error).message,
    });
  }
};

/**
 * Unsubscribes and stops routing incoming messages. Intended for graceful
 * shutdown, followed by `disconnectMqtt()` for the socket-level tear-down.
 */
export const stopMqttConsumer = async (): Promise<void> => {
  const client = getMqttClient();
  await new Promise<void>((resolve) => {
    client.unsubscribe(env.MQTT_SUBSCRIBE_TOPIC, {}, () => {
      logger.info(`MQTT unsubscribed from ${env.MQTT_SUBSCRIBE_TOPIC}`);
      resolve();
    });
  });
  client.removeAllListeners('message');
};
