import { InfluxDB, type QueryApi, type WriteApi } from '@influxdata/influxdb-client';
import { env } from './env';
import { logger } from './logger';

/**
 * InfluxDB connection singleton.
 *
 * The official client is fully async and stateless at the socket level —
 * it reconnects on every write/query — so "connecting" here is really about
 * constructing the write/query APIs once and verifying reachability on boot.
 */
let influxClient: InfluxDB | null = null;
let writeApi: WriteApi | null = null;
let queryApi: QueryApi | null = null;
let healthy = false;

/**
 * Constructs the client, opens a batched write API, and performs a cheap
 * health-check query so misconfigured tokens/URLs fail during startup.
 */
export const connectInfluxDB = async (): Promise<void> => {
  influxClient = new InfluxDB({
    url: env.INFLUX_URL,
    token: env.INFLUX_TOKEN,
    timeout: 10_000,
  });

  // Batched writes: coalesce points for throughput, but flush quickly enough
  // that the dashboard sees data within a couple of seconds.
  writeApi = influxClient.getWriteApi(env.INFLUX_ORG, env.INFLUX_BUCKET, 'ms', {
    batchSize: 200,
    flushInterval: 1_000,
    maxRetries: 5,
    maxRetryDelay: 15_000,
    minRetryDelay: 1_000,
    retryJitter: 500,
    writeFailed: (error, lines, attempt) => {
      logger.error('InfluxDB write failed', {
        attempt,
        lineCount: lines.length,
        error: (error as Error).message,
      });
    },
    writeSuccess: (lines) => {
      logger.debug(`InfluxDB wrote batch (${lines.length} lines)`);
    },
  });

  queryApi = influxClient.getQueryApi(env.INFLUX_ORG);

  // Cheap sanity check — bucket listing via Flux.
  await new Promise<void>((resolve, reject) => {
    const fluxQuery = `buckets() |> filter(fn: (r) => r.name == "${env.INFLUX_BUCKET}") |> limit(n: 1)`;
    let found = false;
    queryApi!.queryRows(fluxQuery, {
      next: () => {
        found = true;
      },
      error: (error) => reject(error),
      complete: () => {
        if (!found) {
          reject(
            new Error(
              `InfluxDB bucket "${env.INFLUX_BUCKET}" not found for org "${env.INFLUX_ORG}"`,
            ),
          );
          return;
        }
        resolve();
      },
    });
  });

  healthy = true;
  logger.info(
    `InfluxDB connected → url="${env.INFLUX_URL}" org="${env.INFLUX_ORG}" bucket="${env.INFLUX_BUCKET}"`,
  );
};

/**
 * Flushes any pending writes and tears the client down.
 * Intended for SIGINT/SIGTERM shutdown.
 */
export const disconnectInfluxDB = async (): Promise<void> => {
  healthy = false;
  if (writeApi) {
    try {
      await writeApi.close();
      logger.info('InfluxDB writer closed');
    } catch (error) {
      logger.error('Error closing InfluxDB writer', error);
    }
    writeApi = null;
  }
  queryApi = null;
  influxClient = null;
};

export const getWriteApi = (): WriteApi => {
  if (!writeApi) {
    throw new Error('InfluxDB writer not initialised — call connectInfluxDB() first');
  }
  return writeApi;
};

export const getQueryApi = (): QueryApi => {
  if (!queryApi) {
    throw new Error('InfluxDB query API not initialised — call connectInfluxDB() first');
  }
  return queryApi;
};

export const isInfluxHealthy = (): boolean => healthy;
