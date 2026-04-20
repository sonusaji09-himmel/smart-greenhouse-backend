/**
 * Operational thresholds for each environmental sensor.
 *
 * A value is classified as:
 *   - "critical" when value < min or value > max
 *   - "warning"  when value is outside (optimalMin, optimalMax) but inside [min, max]
 *   - "optimal"  when optimalMin <= value <= optimalMax
 *
 * These live in code today but are structured so they can later be moved to
 * a database-backed settings service without touching controllers or services.
 */
export interface SensorThreshold {
  readonly min: number;
  readonly optimalMin: number;
  readonly optimalMax: number;
  readonly max: number;
  readonly unit: string;
}

export const SENSOR_THRESHOLDS = {
  temperature: {
    min: 10,
    optimalMin: 18,
    optimalMax: 28,
    max: 40,
    unit: '°C',
  },
  humidity: {
    min: 20,
    optimalMin: 50,
    optimalMax: 75,
    max: 90,
    unit: '%',
  },
  soilMoisture: {
    min: 20,
    optimalMin: 40,
    optimalMax: 70,
    max: 90,
    unit: '%',
  },
  light: {
    min: 200,
    optimalMin: 500,
    optimalMax: 2000,
    max: 5000,
    unit: 'lux',
  },
} as const satisfies Record<string, SensorThreshold>;

export type SensorKey = keyof typeof SENSOR_THRESHOLDS;

export const SENSOR_STATUS = {
  OPTIMAL: 'optimal',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type SensorStatus = (typeof SENSOR_STATUS)[keyof typeof SENSOR_STATUS];
