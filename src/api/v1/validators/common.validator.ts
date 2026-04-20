import { z } from './zodOpenApi';

/**
 * Reusable primitive schemas, composed into request/response schemas elsewhere.
 * Centralizing them keeps naming and error messages consistent across the API.
 */
export const percentageSchema = z
  .number({ message: 'Value must be a number' })
  .min(0, 'Value must be at least 0%')
  .max(100, 'Value must be at most 100%');

export const isoDateStringSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO-8601 datetime string' });

/**
 * Uniform error envelope returned by validation failures and thrown AppErrors.
 * Documented once so every endpoint can reference it via $ref.
 */
export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    message: z.string(),
    code: z.string(),
    statusCode: z.number().int(),
    details: z.unknown().optional(),
  })
  .openapi('ErrorResponse');
