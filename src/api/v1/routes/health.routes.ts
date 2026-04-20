import { Router } from 'express';
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { z } from '../validators/zodOpenApi';
import { openApiRegistry } from '../../../config/openapi';

const router = Router();

const healthResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      status: z.enum(['ok', 'degraded']),
      uptimeSeconds: z.number(),
      database: z.enum(['connected', 'connecting', 'disconnected']),
      timestamp: z.string().datetime({ offset: true }),
    }),
  })
  .openapi('HealthResponse');

const DB_STATE = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnected',
} as const;

router.get('/', (_req, res) => {
  const readyState = mongoose.connection.readyState as keyof typeof DB_STATE;
  const dbStatus = DB_STATE[readyState] ?? 'disconnected';
  const isHealthy = dbStatus === 'connected';

  res.status(isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    success: true,
    data: {
      status: isHealthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Service health probe',
  description: 'Reports API liveness and MongoDB connectivity. Suitable for load-balancer checks.',
  responses: {
    200: {
      description: 'Service is healthy',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
    503: {
      description: 'Service is degraded (e.g. DB disconnected)',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
  },
});

export { router as healthRouter };
