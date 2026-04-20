import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { env } from './env';

/**
 * Single shared OpenAPI registry.
 *
 * Routes, validators, and response schemas register themselves into this
 * registry so that the generated spec stays in lock-step with the real code.
 */
export const openApiRegistry = new OpenAPIRegistry();

openApiRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT issued by `POST /auth/login`. Only required when `AUTH_ENABLED=true`.',
});

/**
 * Generates the final OpenAPI 3.1 document. Call this after all routes and
 * schemas have been registered (i.e. after route modules have been imported).
 */
export const buildOpenApiDocument = () => {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Smart Greenhouse API',
      version: '2.0.0',
      description:
        'Real-time IoT backend for the Smart Greenhouse platform. ESP32 devices publish telemetry over MQTT; the backend consumes, validates, and stores it in InfluxDB, and serves query and aggregation APIs to a React dashboard.',
      contact: { name: 'Smart Greenhouse Team' },
      license: { name: 'MIT' },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}${env.API_PREFIX}/${env.API_VERSION}`,
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication and JWT issuance' },
      { name: 'Sensors', description: 'Sensor ingestion, history, and aggregations' },
      { name: 'Dashboard', description: 'Aggregated dashboard endpoints' },
      { name: 'Health', description: 'Service health and liveness probes' },
    ],
  });
};
