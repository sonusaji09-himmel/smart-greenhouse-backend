import { env } from '../config/env';

/**
 * Topic naming convention:
 *
 *   greenhouse/{deviceId}/telemetry   — sensor readings (device → backend)
 *   greenhouse/{deviceId}/commands    — actuation commands (backend → device)
 *   greenhouse/{deviceId}/status      — birth / LWT (device → backend)
 *
 * The prefix is configurable via `MQTT_TOPIC_PREFIX` so the same broker can
 * host multiple environments (dev / staging / prod).
 */
export const telemetryTopic = (deviceId: string): string =>
  `${env.MQTT_TOPIC_PREFIX}/${deviceId}/telemetry`;

export const commandTopic = (deviceId: string): string =>
  `${env.MQTT_TOPIC_PREFIX}/${deviceId}/commands`;

export const statusTopic = (deviceId: string): string =>
  `${env.MQTT_TOPIC_PREFIX}/${deviceId}/status`;

/**
 * Extracts the deviceId from a topic, returning null if the shape doesn't
 * match the expected `{prefix}/{deviceId}/{suffix}` pattern.
 */
export const parseDeviceIdFromTopic = (topic: string): string | null => {
  const parts = topic.split('/');
  if (parts.length < 3) return null;
  const [prefix, deviceId] = parts;
  if (prefix !== env.MQTT_TOPIC_PREFIX) return null;
  return deviceId?.trim() || null;
};
