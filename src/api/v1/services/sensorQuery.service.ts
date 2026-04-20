import { env } from '../../../config/env';
import { getQueryApi } from '../../../config/influxdb';
import type {
  AggregateQuery,
  LatestQuery,
  SensorAggregateBucket,
  SensorReadingPoint,
  TimeRangeQuery,
} from '../validators/sensor.validator';

/**
 * Escape an arbitrary string as a Flux string literal. Uses `JSON.stringify`,
 * which produces exactly the same escape rules Flux accepts.
 */
const fluxStr = (value: string): string => JSON.stringify(value);

/**
 * Resolve `{ from, to, window }` into Flux `range(start:, stop:)` expressions.
 *
 * Precedence:
 *   1. Absolute `from` → `from → (to ?? now())`
 *   2. Relative `window` → `-window → now()` (default 24h)
 */
const resolveRange = (
  query: Pick<TimeRangeQuery, 'from' | 'to' | 'window'>,
): { startExpr: string; stopExpr: string } => {
  if (query.from) {
    return {
      startExpr: new Date(query.from).toISOString(),
      stopExpr: query.to ? new Date(query.to).toISOString() : 'now()',
    };
  }
  const window = query.window ?? '24h';
  return {
    startExpr: `-${window}`,
    stopExpr: 'now()',
  };
};

const rowToPoint = (row: Record<string, unknown>): SensorReadingPoint => ({
  deviceId: String(row.deviceId ?? 'unknown'),
  temperature: Number(row.temperature ?? 0),
  humidity: Number(row.humidity ?? 0),
  soilMoisture: Number(row.soilMoisture ?? 0),
  lightLevel: Number(row.lightLevel ?? 0),
  recordedAt: new Date(String(row._time)).toISOString(),
});

const rowToBucket = (row: Record<string, unknown>): SensorAggregateBucket => {
  const numberOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    time: new Date(String(row._time)).toISOString(),
    temperature: numberOrNull(row.temperature),
    humidity: numberOrNull(row.humidity),
    soilMoisture: numberOrNull(row.soilMoisture),
    lightLevel: numberOrNull(row.lightLevel),
  };
};

const collectRows = async <T>(
  fluxQuery: string,
  mapper: (row: Record<string, unknown>) => T,
): Promise<T[]> => {
  const api = getQueryApi();
  const rows: T[] = [];
  for await (const { values, tableMeta } of api.iterateRows(fluxQuery)) {
    const row = tableMeta.toObject(values) as Record<string, unknown>;
    rows.push(mapper(row));
  }
  return rows;
};

/**
 * Read-side of the sensor data layer. All Flux lives here so controllers
 * never touch the query API directly.
 */
export const sensorQueryService = {
  /**
   * Latest sample across all devices (or a specific device), looked up
   * within a bounded 24h tail to keep the query cheap.
   */
  async latest(query: LatestQuery): Promise<SensorReadingPoint | null> {
    const deviceFilter = query.deviceId
      ? `|> filter(fn: (r) => r.deviceId == ${fluxStr(query.deviceId)})`
      : '';

    const fluxQuery = `
      from(bucket: ${fluxStr(env.INFLUX_BUCKET)})
        |> range(start: -24h)
        |> filter(fn: (r) => r._measurement == ${fluxStr(env.INFLUX_MEASUREMENT)})
        ${deviceFilter}
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const points = await collectRows<SensorReadingPoint>(fluxQuery, rowToPoint);
    return points[0] ?? null;
  },

  /**
   * Raw sensor points within a time range, oldest first. The caller's
   * `limit` is capped by the validator (max 10k).
   */
  async history(query: TimeRangeQuery): Promise<SensorReadingPoint[]> {
    const { startExpr, stopExpr } = resolveRange(query);
    const deviceFilter = query.deviceId
      ? `|> filter(fn: (r) => r.deviceId == ${fluxStr(query.deviceId)})`
      : '';

    const start = startExpr.startsWith('-') ? startExpr : `time(v: ${fluxStr(startExpr)})`;
    const stop = stopExpr === 'now()' ? 'now()' : `time(v: ${fluxStr(stopExpr)})`;

    const fluxQuery = `
      from(bucket: ${fluxStr(env.INFLUX_BUCKET)})
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r._measurement == ${fluxStr(env.INFLUX_MEASUREMENT)})
        ${deviceFilter}
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: false)
        |> limit(n: ${query.limit})
    `;

    return collectRows<SensorReadingPoint>(fluxQuery, rowToPoint);
  },

  /**
   * Windowed aggregation. `fn` is an enum-whitelisted Flux identifier and
   * `every` / window are regex-validated durations, so direct interpolation
   * is safe.
   */
  async aggregate(
    query: AggregateQuery,
  ): Promise<{ fn: string; every: string; buckets: SensorAggregateBucket[] }> {
    const { startExpr, stopExpr } = resolveRange(query);
    const deviceFilter = query.deviceId
      ? `|> filter(fn: (r) => r.deviceId == ${fluxStr(query.deviceId)})`
      : '';

    const start = startExpr.startsWith('-') ? startExpr : `time(v: ${fluxStr(startExpr)})`;
    const stop = stopExpr === 'now()' ? 'now()' : `time(v: ${fluxStr(stopExpr)})`;

    const fluxQuery = `
      from(bucket: ${fluxStr(env.INFLUX_BUCKET)})
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r._measurement == ${fluxStr(env.INFLUX_MEASUREMENT)})
        ${deviceFilter}
        |> aggregateWindow(every: ${query.every}, fn: ${query.fn}, createEmpty: true)
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: false)
    `;

    const buckets = await collectRows<SensorAggregateBucket>(fluxQuery, rowToBucket);
    return { fn: query.fn, every: query.every, buckets };
  },
};

export type SensorQueryService = typeof sensorQueryService;
