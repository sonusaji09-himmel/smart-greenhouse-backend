import { z } from './zodOpenApi';
import { SENSOR_STATUS } from '../../../constants/sensorThresholds';

/**
 * Shape of a single "sensor tile" on the dashboard: its most recent value,
 * the unit used to render it, and a pre-computed status bucket.
 */
export const sensorSummarySchema = z
  .object({
    value: z.number().openapi({ example: 24.5 }),
    unit: z.string().openapi({ example: '°C' }),
    status: z
      .enum([SENSOR_STATUS.OPTIMAL, SENSOR_STATUS.WARNING, SENSOR_STATUS.CRITICAL])
      .openapi({ example: SENSOR_STATUS.OPTIMAL }),
  })
  .openapi('SensorSummary');

/**
 * Payload returned by `GET /dashboard/overview`.
 * Nullable fields account for the "no readings yet" state.
 */
export const dashboardOverviewSchema = z
  .object({
    temperature: sensorSummarySchema,
    humidity: sensorSummarySchema,
    soilMoisture: sensorSummarySchema,
    light: sensorSummarySchema,
    lastUpdated: z.string().datetime({ offset: true }),
  })
  .openapi('DashboardOverview');

export const dashboardOverviewResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.union([
      dashboardOverviewSchema,
      z.object({ message: z.string() }).openapi('DashboardEmptyState'),
    ]),
  })
  .openapi('DashboardOverviewResponse');

export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export type SensorSummary = z.infer<typeof sensorSummarySchema>;
