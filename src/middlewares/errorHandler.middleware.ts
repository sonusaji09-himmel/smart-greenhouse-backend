import type { ErrorRequestHandler } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';
import mongoose from 'mongoose';
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

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      code: 'DB_VALIDATION_ERROR',
      message: 'Database validation failed',
      details: Object.values(err.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      code: 'INVALID_IDENTIFIER',
      message: `Invalid value for "${err.path}"`,
    };
  }

  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  ) {
    return {
      statusCode: StatusCodes.CONFLICT,
      code: 'DUPLICATE_KEY',
      message: 'Resource already exists',
    };
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
