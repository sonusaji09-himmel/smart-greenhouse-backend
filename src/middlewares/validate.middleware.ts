import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { StatusCodes } from 'http-status-codes';
import type { ErrorEnvelope } from '../utils/ApiResponse';

/**
 * Describes which parts of a request a route wants validated. Each entry is
 * optional — consumers only pass schemas for the parts they care about.
 */
export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

interface FieldIssue {
  path: string;
  message: string;
  code: string;
}

const formatIssues = (source: string, error: ZodError): FieldIssue[] =>
  error.issues.map((issue) => ({
    path: [source, ...issue.path.map((part) => String(part))].join('.'),
    message: issue.message,
    code: issue.code,
  }));

/**
 * Express middleware factory that validates `req.body`, `req.query`, and/or
 * `req.params` against Zod schemas.
 *
 * Parsed (and coerced) values are written back onto the request so downstream
 * controllers receive strongly typed data.
 */
export const validateRequest =
  (schemas: ValidationSchemas): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const issues: FieldIssue[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        issues.push(...formatIssues('body', result.error));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
        });
      } else {
        issues.push(...formatIssues('query', result.error));
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as typeof req.params;
      } else {
        issues.push(...formatIssues('params', result.error));
      }
    }

    if (issues.length === 0) {
      return next();
    }

    const payload: ErrorEnvelope = {
      success: false,
      message: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: StatusCodes.BAD_REQUEST,
      details: issues,
    };

    res.status(StatusCodes.BAD_REQUEST).json(payload);
  };
