import { env } from '../../../config/env';
import { getQueryApi } from '../../../config/influxdb';
import { ALERT_THRESHOLDS } from '../../../constants/sensorThresholds';

interface AlertCondition {
  key: string;
  field: 'temperature' | 'soilMoisture' | 'lightLevel';
  direction: 'above' | 'below';
  threshold: number;
  durationHours: number;
  message: string;
}

export interface ActiveAlert {
  condition: string;
  message: string;
  since: string;
  durationHours: number;
}

const fluxStr = (value: string): string => JSON.stringify(value);

const CONDITIONS: AlertCondition[] = [
  {
    key: 'temperature-high',
    field: 'temperature',
    direction: 'above',
    threshold: ALERT_THRESHOLDS.temperature.above,
    durationHours: ALERT_THRESHOLDS.temperature.durationHours,
    message: `Temperature above ${ALERT_THRESHOLDS.temperature.above}°C for ${ALERT_THRESHOLDS.temperature.durationHours}h`,
  },
  {
    key: 'soil-dry',
    field: 'soilMoisture',
    direction: 'below',
    threshold: ALERT_THRESHOLDS.soilDry.below,
    durationHours: ALERT_THRESHOLDS.soilDry.durationHours,
    message: `Soil moisture below ${ALERT_THRESHOLDS.soilDry.below}% for ${ALERT_THRESHOLDS.soilDry.durationHours}h`,
  },
  {
    key: 'soil-wet',
    field: 'soilMoisture',
    direction: 'above',
    threshold: ALERT_THRESHOLDS.soilWet.above,
    durationHours: ALERT_THRESHOLDS.soilWet.durationHours,
    message: `Soil moisture above ${ALERT_THRESHOLDS.soilWet.above}% for ${ALERT_THRESHOLDS.soilWet.durationHours}h`,
  },
  {
    key: 'darkness',
    field: 'lightLevel',
    direction: 'below',
    threshold: ALERT_THRESHOLDS.darkness.below,
    durationHours: ALERT_THRESHOLDS.darkness.durationHours,
    message: `Light below ${ALERT_THRESHOLDS.darkness.below}% for ${ALERT_THRESHOLDS.darkness.durationHours}h`,
  },
];

const conditionToFlux = (condition: AlertCondition, deviceId?: string): string => {
  const deviceFilter = deviceId ? `|> filter(fn: (r) => r.deviceId == ${fluxStr(deviceId)})` : '';

  const comparator = condition.direction === 'above' ? 'min' : 'max';

  return `
    from(bucket: ${fluxStr(env.INFLUX_BUCKET)})
      |> range(start: -${condition.durationHours}h)
      |> filter(fn: (r) => r._measurement == ${fluxStr(env.INFLUX_MEASUREMENT)})
      |> filter(fn: (r) => r._field == ${fluxStr(condition.field)})
      ${deviceFilter}
      |> group()
      |> ${comparator}()
      |> keep(columns: ["_time", "_value"])
  `;
};

const evaluateCondition = async (
  condition: AlertCondition,
  deviceId?: string,
): Promise<ActiveAlert | null> => {
  const queryApi = getQueryApi();
  const fluxQuery = conditionToFlux(condition, deviceId);

  let value: number | null = null;
  try {
    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
      const row = tableMeta.toObject(values) as Record<string, unknown>;
      value = Number(row._value);
    }
  } catch {
    return null;
  }

  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const isTriggered =
    condition.direction === 'above' ? value > condition.threshold : value < condition.threshold;

  if (!isTriggered) {
    return null;
  }

  return {
    condition: condition.key,
    message: condition.message,
    since: new Date(Date.now() - condition.durationHours * 60 * 60 * 1000).toISOString(),
    durationHours: condition.durationHours,
  };
};

export const alertEngineService = {
  async getActiveAlerts(deviceId?: string): Promise<ActiveAlert[]> {
    const results = await Promise.allSettled(
      CONDITIONS.map((condition) => evaluateCondition(condition, deviceId)),
    );
    return results
      .filter(
        (r): r is PromiseFulfilledResult<ActiveAlert> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  },
};

export type AlertEngineService = typeof alertEngineService;
