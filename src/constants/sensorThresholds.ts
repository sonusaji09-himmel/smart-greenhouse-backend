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
  soilMoisture: {
    min: 20,
    optimalMin: 40,
    optimalMax: 70,
    max: 90,
    unit: '%',
  },
  light: {
    min: 5,
    optimalMin: 30,
    optimalMax: 80,
    max: 100,
    unit: '%',
  },
} as const satisfies Record<string, SensorThreshold>;

export type SensorKey = keyof typeof SENSOR_THRESHOLDS;

export const SENSOR_STATUS = {
  OPTIMAL: 'optimal',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type SensorStatus = (typeof SENSOR_STATUS)[keyof typeof SENSOR_STATUS];

/**
 * Control thresholds used by automation and manual-override validation.
 */
export const AUTOMATION_THRESHOLDS = {
  pump: { startBelow: 50, stopAbove: 80 },
  lights: { turnOnBelow: 30, turnOffAbove: 70 },
  window: { openAboveTemp: 27, closeBelowTemp: 24 },
  waterTank: { minLevelPct: 5 },
} as const;

/**
 * Sustained-condition thresholds for alert generation.
 */
export const ALERT_THRESHOLDS = {
  temperature: { above: 30, durationHours: 5 },
  soilDry: { below: 40, durationHours: 96 },
  soilWet: { above: 80, durationHours: 96 },
  darkness: { below: 20, durationHours: 6 },
} as const;
