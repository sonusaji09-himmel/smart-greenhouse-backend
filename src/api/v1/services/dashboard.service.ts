import { SENSOR_THRESHOLDS } from '../../../constants/sensorThresholds';
import type { DashboardOverview } from '../validators/dashboard.validator';
import { sensorService } from './sensor.service';
import { evaluateSensorStatus } from './sensorStatus.service';

/**
 * Aggregates the latest raw sensor reading into the shape the dashboard UI
 * renders. Encapsulates every rule about which thresholds and units apply to
 * which sensor, so controllers stay dumb.
 */
export const dashboardService = {
  async getOverview(): Promise<DashboardOverview | null> {
    const latest = await sensorService.getLatestReading();

    if (!latest) {
      return null;
    }

    return {
      temperature: {
        value: latest.temperature,
        unit: SENSOR_THRESHOLDS.temperature.unit,
        status: evaluateSensorStatus(latest.temperature, SENSOR_THRESHOLDS.temperature),
      },
      humidity: {
        value: latest.humidity,
        unit: SENSOR_THRESHOLDS.humidity.unit,
        status: evaluateSensorStatus(latest.humidity, SENSOR_THRESHOLDS.humidity),
      },
      soilMoisture: {
        value: latest.soilMoisture,
        unit: SENSOR_THRESHOLDS.soilMoisture.unit,
        status: evaluateSensorStatus(latest.soilMoisture, SENSOR_THRESHOLDS.soilMoisture),
      },
      light: {
        value: latest.lightLevel,
        unit: SENSOR_THRESHOLDS.light.unit,
        status: evaluateSensorStatus(latest.lightLevel, SENSOR_THRESHOLDS.light),
      },
      lastUpdated: latest.recordedAt.toISOString(),
    };
  },
};

export type DashboardService = typeof dashboardService;
