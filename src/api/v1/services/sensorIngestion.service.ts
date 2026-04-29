import { Point } from '@influxdata/influxdb-client';
import { env } from '../../../config/env';
import { getWriteApi } from '../../../config/influxdb';
import { logger } from '../../../config/logger';
import { automationEngineService } from './automationEngine.service';
import { sseEmitterService } from './sseEmitter.service';
import type { SensorReadingInput } from '../validators/sensor.validator';

/**
 * Short-lived in-memory cache of recently seen `messageId`s per device.
 *
 * InfluxDB itself deduplicates on (measurement, tag-set, timestamp), which is
 * the primary correctness guarantee. This cache is a cheap fast-path that
 * avoids re-writing a point we just processed in the current process (e.g.
 * when the broker redelivers a QoS-1 message before our ACK lands).
 */
const SEEN_TTL_MS = 60_000;
const seen = new Map<string, number>();

const rememberMessage = (deviceId: string, messageId: string): boolean => {
  const key = `${deviceId}::${messageId}`;
  const now = Date.now();
  const existing = seen.get(key);
  if (existing && now - existing < SEEN_TTL_MS) {
    return false;
  }
  seen.set(key, now);
  if (seen.size > 5_000) {
    const cutoff = now - SEEN_TTL_MS;
    for (const [k, ts] of seen) {
      if (ts < cutoff) seen.delete(k);
    }
  }
  return true;
};

export interface IngestResult {
  deviceId: string;
  recordedAt: Date;
  deduplicated: boolean;
}

/**
 * Writes a single sensor sample as a batched point into InfluxDB.
 *
 * Idempotency strategy:
 *  1. If `messageId` is provided and seen in the last 60s, drop the sample.
 *  2. Otherwise build a Point with deviceId as a tag — Influx will collapse
 *     duplicate (measurement, tags, timestamp) tuples to a single row.
 */
export const sensorIngestionService = {
  async ingest(input: SensorReadingInput): Promise<IngestResult> {
    const deviceId = input.deviceId?.trim() || 'esp32-01';
    const recordedAt = input.timestamp ? new Date(input.timestamp) : new Date();

    if (input.messageId) {
      const fresh = rememberMessage(deviceId, input.messageId);
      if (!fresh) {
        logger.debug('Dropped duplicate sensor message', {
          deviceId,
          messageId: input.messageId,
        });
        return { deviceId, recordedAt, deduplicated: true };
      }
    }

    const point = new Point(env.INFLUX_MEASUREMENT)
      .tag('deviceId', deviceId)
      .floatField('temperature', input.temperature)
      .floatField('humidity', input.humidity)
      .floatField('soilMoisture', input.soilMoisture)
      .floatField('lightLevel', input.lightLevel)
      .timestamp(recordedAt);

    if (typeof input.waterLevel === 'number') {
      point.floatField('waterLevel', input.waterLevel);
    }

    getWriteApi().writePoint(point);

    logger.debug('Queued sensor reading for Influx write', {
      deviceId,
      recordedAt: recordedAt.toISOString(),
    });

    await automationEngineService.handleReading(input, deviceId, recordedAt.toISOString());

    sseEmitterService.broadcast({
      type: 'sensor-reading',
      payload: {
        deviceId,
        temperature: input.temperature,
        humidity: input.humidity,
        soilMoisture: input.soilMoisture,
        lightLevel: input.lightLevel,
        waterLevel: input.waterLevel,
        recordedAt: recordedAt.toISOString(),
      },
    });

    return { deviceId, recordedAt, deduplicated: false };
  },

  /**
   * Forces any buffered points to be sent immediately. Useful before
   * responding to HTTP ingestion requests that want read-your-writes
   * semantics — and on graceful shutdown.
   */
  async flush(): Promise<void> {
    await getWriteApi().flush();
  },
};

export type SensorIngestionService = typeof sensorIngestionService;
