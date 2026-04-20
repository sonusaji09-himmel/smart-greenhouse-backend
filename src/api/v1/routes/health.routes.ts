import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from '../validators/zodOpenApi';
import { openApiRegistry } from '../../../config/openapi';
import { isInfluxHealthy } from '../../../config/influxdb';
import { isMqttConnected } from '../../../mqtt/mqttClient';

const router = Router();

const healthResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      status: z.enum(['ok', 'degraded']),
      uptimeSeconds: z.number(),
      influxdb: z.enum(['connected', 'disconnected']),
      mqtt: z.enum(['connected', 'disconnected']),
      timestamp: z.string().datetime({ offset: true }),
    }),
  })
  .openapi('HealthResponse');

router.get('/', (_req, res) => {
  const influxStatus = isInfluxHealthy() ? 'connected' : 'disconnected';
  const mqttStatus = isMqttConnected() ? 'connected' : 'disconnected';
  const isHealthy = influxStatus === 'connected';

  res.status(isHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    success: true,
    data: {
      status: isHealthy ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      influxdb: influxStatus,
      mqtt: mqttStatus,
      timestamp: new Date().toISOString(),
    },
  });
});

openApiRegistry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Service health probe',
  description:
    'Reports API liveness, InfluxDB connectivity, and MQTT broker connectivity. Suitable for load-balancer checks.',
  responses: {
    200: {
      description: 'Service is healthy',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
    503: {
      description: 'Service is degraded (e.g. InfluxDB unreachable)',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
  },
});

export { router as healthRouter };
