import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { env } from './env';

/**
 * Single shared OpenAPI registry.
 *
 * Routes, validators, and response schemas register themselves into this
 * registry so that the generated spec stays in lock-step with the real code.
 */
export const openApiRegistry = new OpenAPIRegistry();

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
      version: '1.0.0',
      description:
        'Backend API for the Smart Greenhouse platform. Ingests sensor readings from ESP32 devices and serves an aggregated dashboard overview for the React frontend.',
      contact: {
        name: 'Smart Greenhouse Team',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}${env.API_PREFIX}/${env.API_VERSION}`,
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Sensors', description: 'Sensor data ingestion endpoints' },
      { name: 'Dashboard', description: 'Aggregated dashboard endpoints' },
      { name: 'Health', description: 'Service health and liveness probes' },
    ],
  });
};
