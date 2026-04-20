import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so that rejected promises are forwarded to
 * `next()` and picked up by the global error-handling middleware.
 *
 * Lets controllers use plain async/await without try/catch boilerplate.
 */
export const asyncHandler =
  <Req extends Request = Request, Res extends Response = Response>(
    handler: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as Req, res as Res, next)).catch(next);
  };
