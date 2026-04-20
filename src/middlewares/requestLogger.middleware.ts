import morgan from 'morgan';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { httpLogStream } from '../config/logger';

/**
 * HTTP access log middleware.
 *
 * Uses the dev-friendly `dev` format locally and the structured `combined`
 * format in production, streamed into winston so all logs share one pipeline.
 */
export const requestLogger: RequestHandler = morgan(env.isProduction ? 'combined' : 'dev', {
  stream: httpLogStream,
  skip: (req) => req.originalUrl === '/health' || req.originalUrl.startsWith('/api-docs'),
});
