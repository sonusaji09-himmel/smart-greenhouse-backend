import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { authService, type JwtPayload } from '../api/v1/services/auth.service';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

/**
 * Rejects requests that lack a valid `Authorization: Bearer <jwt>` header.
 *
 * Bypassed entirely when `AUTH_ENABLED=false` — useful for local dev and
 * trusted internal networks. Attaches the decoded claims to `req.user` for
 * downstream handlers.
 */
export const authGuard: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!env.AUTH_ENABLED) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing or malformed Authorization header'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(AppError.unauthorized('Empty bearer token'));
  }

  try {
    req.user = authService.verify(token);
    return next();
  } catch (error) {
    return next(error);
  }
};
