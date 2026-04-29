import { z } from './zodOpenApi';

export const alertQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1).max(64).optional().openapi({ example: 'esp32-01' }),
  })
  .openapi('AlertQuery');

const activeAlertSchema = z.object({
  condition: z.string(),
  message: z.string(),
  since: z.string().datetime({ offset: true }),
  durationHours: z.number().int().positive(),
});

export const alertResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      count: z.number().int().nonnegative(),
      alerts: z.array(activeAlertSchema),
    }),
  })
  .openapi('AlertResponse');

export type AlertQueryInput = z.infer<typeof alertQuerySchema>;
