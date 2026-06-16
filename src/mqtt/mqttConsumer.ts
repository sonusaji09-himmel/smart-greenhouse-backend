import { env } from '../config/env';
import { logger } from '../config/logger';
import { sensorIngestionService } from '../api/v1/services/sensorIngestion.service';
import { sensorReadingSchema } from '../api/v1/validators/sensor.validator';
import { connectMqtt, getMqttClient } from './mqttClient';

/**
 * MQTT ingestion pipeline — natively aligned with the ESP32 firmware.
 *
 * The device publishes one human-readable string per sensor on separate
 * topics (no JSON, no device id in the topic):
 *
 *   esp32s3/smartfarm/temp    → "Temperature    :24.50 °C"
 *   esp32s3/smartfarm/light   → "Light Intensity    :60% (Raw ADC: 2048);"
 *   esp32s3/smartfarm/moist1  → "Soil Moisture_1    :45% (Raw ADC: 2048);"
 *   esp32s3/smartfarm/moist2  → "Soil Moisture_2    :50% (Raw ADC: 2048);"
 *
 * We subscribe to the wildcard (`MQTT_SUBSCRIBE_TOPIC`, default
 * `esp32s3/smartfarm/+`), parse the leading number from each message, buffer
 * the fields per device, average the two soil sensors, and after a short
 * debounce window write a single combined reading into InfluxDB.
 *
 * Failures at any step are logged but never crash the process.
 */

interface ReadingBuffer {
  temperature?: number;
  lightLevel?: number;
  moist1?: number;
  moist2?: number;
  timer?: ReturnType<typeof setTimeout>;
}

const buffers = new Map<string, ReadingBuffer>();
let sequence = 0;

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
    handleMessage(topic, payload);
  });
};

/**
 * Extracts the first numeric value from a sensor string. Reads the number
 * after the colon ("Label :<number><unit> ...") and falls back to the first
 * number anywhere in the payload.
 */
const parseFirstNumber = (raw: string): number | null => {
  const afterColon = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  const match = afterColon.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/**
 * Routes one per-field message into the device buffer and schedules a
 * debounced flush. The topic suffix selects the field.
 */
const handleMessage = (topic: string, payload: Buffer): void => {
  const suffix = topic.split('/').pop()?.toLowerCase();
  if (!suffix) return;

  const value = parseFirstNumber(payload.toString('utf8'));
  if (value === null) {
    logger.warn('ESP32 payload had no parseable number', { topic });
    return;
  }

  const deviceId = env.ESP32_DEVICE_ID;
  const buffer = buffers.get(deviceId) ?? {};

  switch (suffix) {
    case 'temp':
    case 'temperature':
      buffer.temperature = value;
      break;
    case 'light':
      buffer.lightLevel = value;
      break;
    case 'moist1':
    case 'moisture1':
      buffer.moist1 = value;
      break;
    case 'moist2':
    case 'moisture2':
      buffer.moist2 = value;
      break;
    default:
      logger.debug('ESP32 topic suffix not recognised', { topic, suffix });
      return;
  }

  if (buffer.timer) clearTimeout(buffer.timer);
  buffer.timer = setTimeout(() => {
    void flush(deviceId);
  }, env.ESP32_FLUSH_MS);

  buffers.set(deviceId, buffer);
};

/**
 * Builds and ingests a combined reading once enough fields are present.
 * Last-known values are retained between cycles so a momentarily missing
 * field never blocks ingestion after the first complete cycle.
 */
const flush = async (deviceId: string): Promise<void> => {
  const buffer = buffers.get(deviceId);
  if (!buffer) return;
  buffer.timer = undefined;

  const moistValues = [buffer.moist1, buffer.moist2].filter(
    (v): v is number => typeof v === 'number',
  );

  if (
    buffer.temperature === undefined ||
    buffer.lightLevel === undefined ||
    moistValues.length === 0
  ) {
    logger.debug('ESP32 reading incomplete — waiting for more fields', {
      deviceId,
      hasTemperature: buffer.temperature !== undefined,
      hasLight: buffer.lightLevel !== undefined,
      moistCount: moistValues.length,
    });
    return;
  }

  const soilMoisture = moistValues.reduce((sum, v) => sum + v, 0) / moistValues.length;

  sequence += 1;
  const candidate = {
    temperature: buffer.temperature,
    soilMoisture: clampPercent(soilMoisture),
    lightLevel: clampPercent(buffer.lightLevel),
    deviceId,
    messageId: `${deviceId}-${Date.now()}-${sequence}`,
  };

  // Internal range check with clamped values — never drops a real reading.
  const parsed = sensorReadingSchema.safeParse(candidate);
  if (!parsed.success) {
    logger.warn('ESP32 reading failed validation', {
      deviceId,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  try {
    const result = await sensorIngestionService.ingest(parsed.data);
    logger.debug('ESP32 reading ingested', {
      deviceId: result.deviceId,
      recordedAt: result.recordedAt.toISOString(),
      temperature: candidate.temperature,
      soilMoisture: candidate.soilMoisture,
      lightLevel: candidate.lightLevel,
    });
  } catch (error) {
    logger.error('Failed to ingest ESP32 reading', {
      deviceId,
      error: (error as Error).message,
    });
  }
};

/**
 * Unsubscribes, clears pending debounce timers, and stops routing incoming
 * messages. Intended for graceful shutdown, followed by `disconnectMqtt()`.
 */
export const stopMqttConsumer = async (): Promise<void> => {
  const client = getMqttClient();
  await new Promise<void>((resolve) => {
    client.unsubscribe(env.MQTT_SUBSCRIBE_TOPIC, {}, () => {
      logger.info(`MQTT unsubscribed from ${env.MQTT_SUBSCRIBE_TOPIC}`);
      resolve();
    });
  });

  for (const buffer of buffers.values()) {
    if (buffer.timer) clearTimeout(buffer.timer);
  }
  buffers.clear();
  client.removeAllListeners('message');
};
