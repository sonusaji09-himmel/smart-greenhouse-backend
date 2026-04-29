import { z } from './zodOpenApi';
import { percentageSchema } from './common.validator';

/**
 * Canonical shape of a sensor reading submitted by a device — either over
 * MQTT (preferred) or via the HTTP fallback endpoint.
 *
 * Units and ranges match the ESP32 firmware contract. An optional
 * `messageId` enables de-duplication at the ingestion layer.
 */
export const sensorReadingSchema = z
  .object({
    temperature: z
      .number({ message: 'Temperature is required' })
      .min(-50, 'Temperature must be between -50 and 100 °C')
      .max(100, 'Temperature must be between -50 and 100 °C')
      .openapi({ example: 24.5, description: 'Air temperature in °C' }),

    humidity: percentageSchema.openapi({ example: 62, description: 'Relative air humidity (%)' }),

    soilMoisture: percentageSchema.openapi({
      example: 38,
      description: 'Volumetric soil moisture (%)',
    }),

    lightLevel: z
      .number({ message: 'Light level is required' })
      .min(0, 'Light level must be between 0 and 100,000 lux')
      .max(100_000, 'Light level must be between 0 and 100,000 lux')
      .openapi({ example: 850, description: 'Ambient light in lux' }),

    waterLevel: percentageSchema
      .optional()
      .openapi({ example: 75, description: 'Water tank level (%)' }),

    timestamp: z
      .string()
      .datetime({ offset: true, message: 'Timestamp must be ISO-8601' })
      .optional()
      .openapi({
        description:
          'Optional ISO-8601 timestamp. If omitted, the server uses the current UTC time.',
        example: '2026-04-20T10:30:00Z',
      }),

    deviceId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .openapi({ example: 'esp32-01', description: 'Source device identifier' }),

    messageId: z.string().trim().min(1).max(128).optional().openapi({
      example: 'esp32-01-00001734',
      description:
        'Optional idempotency key. Duplicate messageIds from the same device are dropped.',
    }),
  })
  .strict()
  .openapi('SensorReading');

export type SensorReadingInput = z.infer<typeof sensorReadingSchema>;

export const createSensorReadingResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      deviceId: z.string(),
      recordedAt: z.string().datetime({ offset: true }),
    }),
  })
  .openapi('CreateSensorReadingResponse');

// ── Query schemas ──────────────────────────────────────────────────────────

/**
 * Flexible window spec accepted as either a string like `"1h"` / `"7d"` or
 * an absolute from/to pair. Both routes normalise into a { start, stop }.
 */
export const timeRangeQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1).max(64).optional().openapi({ example: 'esp32-01' }),
    from: z.string().datetime({ offset: true }).optional().openapi({
      description: 'Start of the query window (inclusive, ISO-8601).',
      example: '2026-04-19T00:00:00Z',
    }),
    to: z.string().datetime({ offset: true }).optional().openapi({
      description: 'End of the query window (exclusive, ISO-8601).',
      example: '2026-04-20T00:00:00Z',
    }),
    window: z
      .string()
      .regex(/^\d+(ms|s|m|h|d|w)$/i, 'window must look like 30s / 15m / 1h / 7d')
      .optional()
      .openapi({
        description:
          'Relative window from "now" (e.g. "1h", "24h", "7d"). Ignored if `from` is set.',
        example: '24h',
      }),
    limit: z.coerce.number().int().positive().max(10_000).default(1_000).openapi({ example: 500 }),
  })
  .openapi('SensorHistoryQuery');

export type TimeRangeQuery = z.infer<typeof timeRangeQuerySchema>;

export const aggregateQuerySchema = timeRangeQuerySchema
  .extend({
    every: z
      .string()
      .regex(/^\d+(ms|s|m|h|d|w)$/i, 'every must look like 1m / 15m / 1h / 1d')
      .default('5m')
      .openapi({ description: 'Bucket width for aggregation', example: '15m' }),
    fn: z
      .enum(['mean', 'min', 'max', 'median', 'sum', 'last'])
      .default('mean')
      .openapi({ description: 'Aggregation function applied per bucket', example: 'mean' }),
  })
  .openapi('SensorAggregateQuery');

export type AggregateQuery = z.infer<typeof aggregateQuerySchema>;

export const latestQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1).max(64).optional().openapi({ example: 'esp32-01' }),
  })
  .openapi('SensorLatestQuery');

export type LatestQuery = z.infer<typeof latestQuerySchema>;

// ── Response schemas ──────────────────────────────────────────────────────

const sensorReadingPointSchema = z
  .object({
    deviceId: z.string().openapi({ example: 'esp32-01' }),
    temperature: z.number().openapi({ example: 24.5 }),
    humidity: z.number().openapi({ example: 62 }),
    soilMoisture: z.number().openapi({ example: 38 }),
    lightLevel: z.number().openapi({ example: 850 }),
    waterLevel: z.number().optional().openapi({ example: 75 }),
    recordedAt: z.string().datetime({ offset: true }),
  })
  .openapi('SensorReadingPoint');

export const sensorLatestResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.union([sensorReadingPointSchema, z.null()]),
  })
  .openapi('SensorLatestResponse');

export const sensorHistoryResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      count: z.number().int().nonnegative(),
      points: z.array(sensorReadingPointSchema),
    }),
  })
  .openapi('SensorHistoryResponse');

const aggregateBucketSchema = z
  .object({
    time: z.string().datetime({ offset: true }),
    temperature: z.number().nullable(),
    humidity: z.number().nullable(),
    soilMoisture: z.number().nullable(),
    lightLevel: z.number().nullable(),
    waterLevel: z.number().nullable().optional(),
  })
  .openapi('SensorAggregateBucket');

export const sensorAggregateResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      fn: z.string(),
      every: z.string(),
      count: z.number().int().nonnegative(),
      buckets: z.array(aggregateBucketSchema),
    }),
  })
  .openapi('SensorAggregateResponse');

export type SensorReadingPoint = z.infer<typeof sensorReadingPointSchema>;
export type SensorAggregateBucket = z.infer<typeof aggregateBucketSchema>;
