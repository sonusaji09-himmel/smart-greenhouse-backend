import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Handles requests that did not match any registered route.
 * Delegates to the global error handler via `next(err)` so the response shape
 * stays consistent.
 */
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
