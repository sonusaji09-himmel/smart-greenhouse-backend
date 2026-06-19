import { env } from '../config/env';

/**
 * Outbound actuator command topic (backend → device):
 *
 *   greenhouse/{deviceId}/commands
 *
 * The prefix is configurable via `MQTT_TOPIC_PREFIX`. Inbound telemetry uses
 * the ESP32's own `esp32s3/smartfarm/*` topics, handled directly in the MQTT
 * consumer (see `mqttConsumer.ts`).
 */
export const commandTopic = (deviceId: string): string =>
  `${env.MQTT_TOPIC_PREFIX}/${deviceId}/commands`;
