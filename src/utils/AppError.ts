import { StatusCodes } from 'http-status-codes';

/**
 * Application-level error. Thrown by services and controllers to signal a
 * well-defined failure whose HTTP status and client-safe message are known.
 *
 * The global error handler converts any AppError into a uniform JSON response;
 * anything else is treated as an unexpected internal error.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, StatusCodes.BAD_REQUEST, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, StatusCodes.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, StatusCodes.FORBIDDEN);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, StatusCodes.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, StatusCodes.CONFLICT, details);
  }

  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(message, StatusCodes.INTERNAL_SERVER_ERROR, details);
  }
}
