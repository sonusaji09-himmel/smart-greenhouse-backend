import { Router } from 'express';
import { sensorController } from '../controllers/sensor.controller';
import { validateRequest } from '../../../middlewares/validate.middleware';
import { authGuard } from '../../../middlewares/auth.middleware';
import {
  aggregateQuerySchema,
  createSensorReadingResponseSchema,
  latestQuerySchema,
  sensorAggregateResponseSchema,
  sensorHistoryResponseSchema,
  sensorLatestResponseSchema,
  sensorReadingSchema,
  timeRangeQuerySchema,
} from '../validators/sensor.validator';
import { errorResponseSchema } from '../validators/common.validator';
import { openApiRegistry } from '../../../config/openapi';

const router = Router();

// ── Ingestion (HTTP fallback; MQTT is the primary path) ──────────────────
router.post('/data', validateRequest({ body: sensorReadingSchema }), sensorController.ingest);

// ── Read endpoints (optionally guarded by JWT via AUTH_ENABLED) ──────────
router.get(
  '/latest',
  authGuard,
  validateRequest({ query: latestQuerySchema }),
  sensorController.latest,
);

router.get(
  '/history',
  authGuard,
  validateRequest({ query: timeRangeQuerySchema }),
  sensorController.history,
);

router.get(
  '/aggregate',
  authGuard,
  validateRequest({ query: aggregateQuerySchema }),
  sensorController.aggregate,
);

// ── OpenAPI ──────────────────────────────────────────────────────────────
openApiRegistry.registerPath({
  method: 'post',
  path: '/sensors/data',
  tags: ['Sensors'],
  summary: 'Ingest a sensor reading (HTTP fallback)',
  description:
    'Secondary ingestion endpoint. In production, devices should publish to MQTT topic `greenhouse/{deviceId}/telemetry`; the backend subscribes and writes the same data into InfluxDB.',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: sensorReadingSchema } },
    },
  },
  responses: {
    201: {
      description: 'Reading accepted and persisted',
      content: { 'application/json': { schema: createSensorReadingResponseSchema } },
    },
    400: {
      description: 'Invalid payload',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/sensors/latest',
  tags: ['Sensors'],
  summary: 'Latest sensor reading',
  description: 'Returns the newest sample across all devices, or for a specific deviceId.',
  request: { query: latestQuerySchema },
  responses: {
    200: {
      description: 'Latest reading or null if none available',
      content: { 'application/json': { schema: sensorLatestResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/sensors/history',
  tags: ['Sensors'],
  summary: 'Historical sensor readings',
  description:
    'Raw points in a time range. Use either `from`/`to` (ISO-8601) or a relative `window` (e.g. `24h`, `7d`). Capped at 10,000 points per request.',
  request: { query: timeRangeQuerySchema },
  responses: {
    200: {
      description: 'Array of points, oldest first',
      content: { 'application/json': { schema: sensorHistoryResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/sensors/aggregate',
  tags: ['Sensors'],
  summary: 'Aggregated sensor insights',
  description:
    'Windowed aggregations using Flux `aggregateWindow`. `fn` may be `mean`, `min`, `max`, `median`, `sum`, or `last`. Example: `?window=24h&every=1h&fn=mean` returns hourly averages for the last day.',
  request: { query: aggregateQuerySchema },
  responses: {
    200: {
      description: 'Aggregated buckets, oldest first',
      content: { 'application/json': { schema: sensorAggregateResponseSchema } },
    },
    400: {
      description: 'Invalid query parameters',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
});

export { router as sensorRouter };
