import { z } from './zodOpenApi';

export const actuatorIdSchema = z.enum(['pump', 'lights', 'window']).openapi('ActuatorId');

export const actuatorParamsSchema = z
  .object({
    actuator: actuatorIdSchema,
  })
  .openapi('ActuatorParams');

export const actuatorCommandQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1).max(64).optional().openapi({ example: 'esp32-01' }),
  })
  .openapi('ActuatorCommandQuery');

const actuatorStateEntrySchema = z.object({
  state: z.enum(['activate', 'deactivate', 'stop']),
  source: z.enum(['manual', 'auto']),
  changedAt: z.string().datetime({ offset: true }),
});

export const actuatorStateResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      pump: z.union([actuatorStateEntrySchema, z.null()]),
      lights: z.union([actuatorStateEntrySchema, z.null()]),
      window: z.union([actuatorStateEntrySchema, z.null()]),
    }),
  })
  .openapi('ActuatorStateResponse');

export const actuatorCommandResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      actuator: actuatorIdSchema,
      action: z.enum(['activate', 'deactivate', 'stop']),
      source: z.enum(['manual', 'auto']),
      deviceId: z.string(),
    }),
  })
  .openapi('ActuatorCommandResponse');

export type ActuatorIdInput = z.infer<typeof actuatorIdSchema>;
export type ActuatorCommandQuery = z.infer<typeof actuatorCommandQuerySchema>;
