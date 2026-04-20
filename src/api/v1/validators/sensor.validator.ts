import { z } from './zodOpenApi';
import { percentageSchema } from './common.validator';

/**
 * Body schema for `POST /sensors/data`.
 *
 * Units and ranges mirror the ASP.NET contract so the ESP32 firmware can keep
 * sending the exact same payload.
 */
export const createSensorReadingSchema = z
  .object({
    temperature: z
      .number({ message: 'Temperature is required' })
      .min(-50, 'Temperature must be between -50 and 100 °C')
      .max(100, 'Temperature must be between -50 and 100 °C')
      .openapi({ example: 24.5, description: 'Air temperature in °C' }),

    humidity: percentageSchema.openapi({ example: 62, description: 'Relative air humidity (%)' }),

    soilMoisture: percentageSchema.openapi({
      example: 38,
      description: 'Volumetric soil moisture (%)',
    }),

    lightLevel: z
      .number({ message: 'Light level is required' })
      .min(0, 'Light level must be between 0 and 100,000 lux')
      .max(100_000, 'Light level must be between 0 and 100,000 lux')
      .openapi({ example: 850, description: 'Ambient light in lux' }),

    timestamp: z
      .string()
      .datetime({ offset: true, message: 'Timestamp must be ISO-8601' })
      .optional()
      .openapi({
        description:
          'Optional ISO-8601 timestamp. If omitted, the server uses the current UTC time.',
        example: '2026-04-15T10:30:00Z',
      }),

    deviceId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .optional()
      .openapi({ example: 'esp32-01', description: 'Source device identifier' }),
  })
  .strict()
  .openapi('CreateSensorReadingRequest');

export type CreateSensorReadingInput = z.infer<typeof createSensorReadingSchema>;

export const createSensorReadingResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      id: z.string(),
      recordedAt: z.string().datetime({ offset: true }),
    }),
  })
  .openapi('CreateSensorReadingResponse');
