import {
  SENSOR_STATUS,
  type SensorStatus,
  type SensorThreshold,
} from '../../../constants/sensorThresholds';

/**
 * Pure mapper from a raw sensor value to a status bucket.
 * Kept stateless so it is trivially unit-testable and safe to reuse.
 */
export const evaluateSensorStatus = (value: number, threshold: SensorThreshold): SensorStatus => {
  if (value < threshold.min || value > threshold.max) {
    return SENSOR_STATUS.CRITICAL;
  }

  if (value < threshold.optimalMin || value > threshold.optimalMax) {
    return SENSOR_STATUS.WARNING;
  }

  return SENSOR_STATUS.OPTIMAL;
};
