/**
 * Uniform envelope for every successful API response.
 *
 * Consistency here lets frontend clients treat every endpoint the same way:
 *   - `success` flips to `false` for error responses (see error handler),
 *   - `data` carries the endpoint-specific payload,
 *   - `message` is optional human-readable context.
 */
export interface SuccessEnvelope<T> {
  success: true;
  message?: string;
  data: T;
}

export const success = <T>(data: T, message?: string): SuccessEnvelope<T> => ({
  success: true,
  ...(message ? { message } : {}),
  data,
});

export interface ErrorEnvelope {
  success: false;
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
}
