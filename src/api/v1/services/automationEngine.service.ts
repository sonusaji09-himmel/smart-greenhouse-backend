import { AUTOMATION_THRESHOLDS } from '../../../constants/sensorThresholds';
import { logger } from '../../../config/logger';
import { actuatorControlService } from './actuatorControl.service';
import type { SensorReadingInput } from '../validators/sensor.validator';

interface AutomationReading {
  deviceId: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightLevel: number;
  waterLevel?: number;
  recordedAt: string;
}

const evaluateActions = (reading: AutomationReading): Array<Promise<void>> => {
  const tasks: Array<Promise<void>> = [];

  if (reading.soilMoisture < AUTOMATION_THRESHOLDS.pump.startBelow) {
    tasks.push(actuatorControlService.activate(reading.deviceId, 'pump', 'auto', reading));
  } else if (reading.soilMoisture > AUTOMATION_THRESHOLDS.pump.stopAbove) {
    tasks.push(actuatorControlService.deactivate(reading.deviceId, 'pump', 'auto'));
  }

  if (reading.lightLevel < AUTOMATION_THRESHOLDS.lights.turnOnBelow) {
    tasks.push(actuatorControlService.activate(reading.deviceId, 'lights', 'auto', reading));
  } else if (reading.lightLevel > AUTOMATION_THRESHOLDS.lights.turnOffAbove) {
    tasks.push(actuatorControlService.deactivate(reading.deviceId, 'lights', 'auto'));
  }

  if (
    reading.temperature > AUTOMATION_THRESHOLDS.window.openWhen.tempAbove &&
    reading.humidity > AUTOMATION_THRESHOLDS.window.openWhen.humidityAbove
  ) {
    tasks.push(actuatorControlService.activate(reading.deviceId, 'window', 'auto', reading));
  } else if (
    reading.temperature < AUTOMATION_THRESHOLDS.window.closeWhen.tempBelow &&
    reading.humidity > AUTOMATION_THRESHOLDS.window.closeWhen.humidityAbove
  ) {
    tasks.push(actuatorControlService.deactivate(reading.deviceId, 'window', 'auto'));
  }

  return tasks;
};

export const automationEngineService = {
  async handleReading(
    input: SensorReadingInput,
    deviceId: string,
    recordedAt: string,
  ): Promise<void> {
    const reading: AutomationReading = {
      deviceId,
      temperature: input.temperature,
      humidity: input.humidity,
      soilMoisture: input.soilMoisture,
      lightLevel: input.lightLevel,
      waterLevel: input.waterLevel,
      recordedAt,
    };

    const actions = evaluateActions(reading);
    const results = await Promise.allSettled(actions);
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.warn('Automation command failed', { error: result.reason });
      }
    }
  },
};

export type AutomationEngineService = typeof automationEngineService;
