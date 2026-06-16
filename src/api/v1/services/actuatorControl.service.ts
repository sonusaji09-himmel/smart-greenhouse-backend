import { StatusCodes } from 'http-status-codes';
import { AUTOMATION_THRESHOLDS } from '../../../constants/sensorThresholds';
import { logger } from '../../../config/logger';
import { getMqttClient } from '../../../mqtt/mqttClient';
import { commandTopic } from '../../../mqtt/topics';
import { AppError } from '../../../utils/AppError';
import type { SensorReadingPoint } from '../validators/sensor.validator';

export const ACTUATOR_IDS = ['pump', 'lights', 'window'] as const;
export type ActuatorId = (typeof ACTUATOR_IDS)[number];
export type CommandSource = 'manual' | 'auto';
export type ActuatorAction = 'activate' | 'deactivate' | 'stop';

interface ActuatorStateEntry {
  state: ActuatorAction;
  source: CommandSource;
  changedAt: string;
}

const state = new Map<ActuatorId, ActuatorStateEntry>();
const AUTO_OVERRIDE_GUARD_MS = 2 * 60_000;

const nowIso = (): string => new Date().toISOString();

const shouldBlockManualActivate = (
  actuator: ActuatorId,
  reading?: SensorReadingPoint,
): string | null => {
  if (!reading) return null;

  if (actuator === 'pump' && reading.soilMoisture >= AUTOMATION_THRESHOLDS.pump.startBelow) {
    return `Pump activate ignored: soil moisture is ${reading.soilMoisture}% (must be below ${AUTOMATION_THRESHOLDS.pump.startBelow}%)`;
  }
  if (actuator === 'lights' && reading.lightLevel >= AUTOMATION_THRESHOLDS.lights.turnOnBelow) {
    return `Lights activate ignored: light level is ${reading.lightLevel}% (must be below ${AUTOMATION_THRESHOLDS.lights.turnOnBelow}%)`;
  }
  if (actuator === 'window' && reading.temperature <= AUTOMATION_THRESHOLDS.window.openAboveTemp) {
    return `Window activate ignored: requires temperature > ${AUTOMATION_THRESHOLDS.window.openAboveTemp}°C`;
  }

  return null;
};

const shouldBlockPumpOnEmptyTank = (reading?: SensorReadingPoint): string | null => {
  if (!reading || typeof reading.waterLevel !== 'number') return null;
  if (reading.waterLevel <= AUTOMATION_THRESHOLDS.waterTank.minLevelPct) {
    return `Pump activate rejected: water tank is ${reading.waterLevel}%`;
  }
  return null;
};

const shouldSkipAuto = (actuator: ActuatorId): boolean => {
  const previous = state.get(actuator);
  if (!previous || previous.source !== 'manual') return false;
  const elapsedMs = Date.now() - new Date(previous.changedAt).getTime();
  return elapsedMs < AUTO_OVERRIDE_GUARD_MS;
};

const publishCommand = async (
  deviceId: string,
  actuator: ActuatorId,
  action: ActuatorAction,
  source: CommandSource,
): Promise<void> => {
  const client = getMqttClient();
  const topic = commandTopic(deviceId);
  const payload = {
    actuator,
    action,
    source,
    timestamp: nowIso(),
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};

const setState = (actuator: ActuatorId, action: ActuatorAction, source: CommandSource): void => {
  state.set(actuator, {
    state: action,
    source,
    changedAt: nowIso(),
  });
};

export const actuatorControlService = {
  async activate(
    deviceId: string,
    actuator: ActuatorId,
    source: CommandSource,
    reading?: SensorReadingPoint,
  ): Promise<void> {
    if (source === 'manual') {
      const invalidManualReason = shouldBlockManualActivate(actuator, reading);
      if (invalidManualReason) {
        throw new AppError(invalidManualReason, StatusCodes.CONFLICT);
      }
    } else if (shouldSkipAuto(actuator)) {
      logger.info('Skipped auto command due to recent manual override', { actuator, deviceId });
      return;
    }

    if (actuator === 'pump') {
      const emptyTankReason = shouldBlockPumpOnEmptyTank(reading);
      if (emptyTankReason) {
        throw new AppError(emptyTankReason, StatusCodes.CONFLICT);
      }
    }

    await publishCommand(deviceId, actuator, 'activate', source);
    setState(actuator, 'activate', source);
  },

  async deactivate(deviceId: string, actuator: ActuatorId, source: CommandSource): Promise<void> {
    if (source === 'auto' && shouldSkipAuto(actuator)) {
      logger.info('Skipped auto command due to recent manual override', { actuator, deviceId });
      return;
    }
    await publishCommand(deviceId, actuator, 'deactivate', source);
    setState(actuator, 'deactivate', source);
  },

  async stop(deviceId: string, actuator: ActuatorId, source: CommandSource): Promise<void> {
    await publishCommand(deviceId, actuator, 'stop', source);
    setState(actuator, 'stop', source);
  },

  getState(): Record<ActuatorId, ActuatorStateEntry | null> {
    return {
      pump: state.get('pump') ?? null,
      lights: state.get('lights') ?? null,
      window: state.get('window') ?? null,
    };
  },
};

export type ActuatorControlService = typeof actuatorControlService;
