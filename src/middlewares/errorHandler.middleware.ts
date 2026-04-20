import type { ErrorRequestHandler } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { ErrorEnvelope } from '../utils/ApiResponse';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const normalize = (err: unknown): NormalizedError => {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: getReasonPhrase(err.statusCode).toUpperCase().replace(/\s+/g, '_'),
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.map((part) => String(part)).join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  // InfluxDB client surfaces HttpError with .statusCode + .body on network /
  // auth failures. Keep the 5xx-ish ones as 502 Bad Gateway so the client
  // can tell "upstream is sick" apart from "your request is malformed".
  if (
    err &&
    typeof err === 'object' &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  ) {
    const upstream = err as { statusCode: number; message?: string };
    if (upstream.statusCode >= 500) {
      return {
        statusCode: StatusCodes.BAD_GATEWAY,
        code: 'UPSTREAM_UNAVAILABLE',
        message: upstream.message ?? 'Upstream data store is unavailable',
      };
    }
  }

  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  };
};

/**
 * Global error handling middleware.
 *
 * Must be registered LAST in the middleware chain. Converts every thrown /
 * forwarded error into the canonical `ErrorEnvelope` JSON shape.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const normalized = normalize(err);

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    statusCode: normalized.statusCode,
    code: normalized.code,
  };

  if (normalized.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
    logger.error(normalized.message, { ...logPayload, err });
  } else {
    logger.warn(normalized.message, logPayload);
  }

  const body: ErrorEnvelope = {
    success: false,
    message: normalized.message,
    code: normalized.code,
    statusCode: normalized.statusCode,
    ...(normalized.details !== undefined ? { details: normalized.details } : {}),
  };

  if (!env.isProduction && err instanceof Error && err.stack) {
    (body as ErrorEnvelope & { stack?: string }).stack = err.stack;
  }

  res.status(normalized.statusCode).json(body);
};
