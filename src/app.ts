import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { logger } from './config/logger';
import { buildOpenApiDocument } from './config/openapi';

import { requestLogger } from './middlewares/requestLogger.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

import { v1Router } from './api/v1/routes';

/**
 * Constructs the Express application.
 *
 * Exported as a factory so the server bootstrap (`server.ts`) and any future
 * integration tests can spin up independent instances without touching
 * module-level state.
 */
export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestLogger);

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
      },
    }),
  );

  const apiBasePath = `${env.API_PREFIX}/${env.API_VERSION}`;
  app.use(apiBasePath, v1Router);

  const openApiDocument = buildOpenApiDocument();
  app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      explorer: true,
      customSiteTitle: 'Smart Greenhouse API Docs',
    }),
  );

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Smart Greenhouse API',
        version: '2.0.0',
        pipeline: 'ESP32 → MQTT → Backend → InfluxDB → API → React',
        docs: '/api-docs',
        api: apiBasePath,
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  logger.debug(`Express application built with API base path "${apiBasePath}"`);

  return app;
};
