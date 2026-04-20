import mqtt, { type MqttClient, type IClientOptions } from 'mqtt';
import { env } from '../config/env';
import { logger } from '../config/logger';

let client: MqttClient | null = null;

/**
 * Connects to the MQTT broker with automatic reconnect enabled.
 *
 * The `mqtt` library handles:
 *   - exponential-ish reconnect with `reconnectPeriod`
 *   - queueing publishes while offline (we rely on this for any outbound
 *     commands; inbound messages come from the broker so they're replayed
 *     via QoS-1 session resumption)
 *   - socket-level errors with automatic retry
 *
 * We log every transition so failures are obvious in production.
 */
export const connectMqtt = async (): Promise<MqttClient> => {
  if (client) return client;

  const options: IClientOptions = {
    clientId: env.MQTT_CLIENT_ID,
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: env.MQTT_RECONNECT_PERIOD_MS,
    connectTimeout: env.MQTT_CONNECT_TIMEOUT_MS,
    // Persistent session so QoS-1 messages queued by the broker are
    // redelivered after a reconnect.
    clean: false,
    keepalive: 30,
    resubscribe: true,
  };

  logger.info(`MQTT connecting → ${env.MQTT_URL} (clientId=${env.MQTT_CLIENT_ID})`);
  const instance = mqtt.connect(env.MQTT_URL, options);

  instance.on('connect', (packet) => {
    logger.info(`MQTT connected (sessionPresent=${packet.sessionPresent ?? false})`);
  });

  instance.on('reconnect', () => {
    logger.warn('MQTT reconnecting...');
  });

  instance.on('close', () => {
    logger.warn('MQTT connection closed');
  });

  instance.on('offline', () => {
    logger.warn('MQTT client is offline');
  });

  instance.on('error', (error) => {
    logger.error('MQTT client error', { message: (error as Error).message });
  });

  // Resolve as soon as the first successful connect fires, so bootstrap
  // doesn't block forever if the broker is unreachable — we let the
  // auto-reconnect logic keep trying in the background.
  await new Promise<void>((resolve) => {
    const onConnect = () => {
      instance.off('connect', onConnect);
      resolve();
    };
    instance.once('connect', onConnect);

    // Safety net: don't block bootstrap forever on the first connect.
    setTimeout(() => {
      instance.off('connect', onConnect);
      logger.warn(
        `MQTT first connect did not complete within ${env.MQTT_CONNECT_TIMEOUT_MS}ms; continuing bootstrap (client will keep retrying)`,
      );
      resolve();
    }, env.MQTT_CONNECT_TIMEOUT_MS).unref();
  });

  client = instance;
  return instance;
};

export const getMqttClient = (): MqttClient => {
  if (!client) {
    throw new Error('MQTT client not initialised — call connectMqtt() first');
  }
  return client;
};

export const isMqttConnected = (): boolean => Boolean(client?.connected);

/**
 * Gracefully closes the MQTT connection, flushing any outbound buffers.
 * Used by the SIGINT/SIGTERM shutdown path.
 */
export const disconnectMqtt = async (): Promise<void> => {
  if (!client) return;
  await new Promise<void>((resolve) => {
    client!.end(false, {}, () => {
      logger.info('MQTT connection closed');
      resolve();
    });
  });
  client = null;
};
