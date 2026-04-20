import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectInfluxDB, disconnectInfluxDB } from './config/influxdb';
import { logger } from './config/logger';
import { startMqttConsumer, stopMqttConsumer } from './mqtt/mqttConsumer';
import { disconnectMqtt } from './mqtt/mqttClient';
import { sensorIngestionService } from './api/v1/services/sensorIngestion.service';

/**
 * Application entry point.
 *
 * Responsibilities:
 *   1. Open the InfluxDB connection (fail fast on bad creds).
 *   2. Start the MQTT consumer (never blocks on an unreachable broker;
 *      it retries in the background).
 *   3. Build the Express app and start listening.
 *   4. Wire graceful shutdown: stop accepting HTTP, drain MQTT, flush the
 *      InfluxDB write buffer, close sockets.
 */
const bootstrap = async (): Promise<void> => {
  await connectInfluxDB();

  // MQTT is best-effort at startup — if the broker is down the API must
  // still come up so the dashboard keeps serving historical data. The
  // consumer's auto-reconnect loop will catch up once the broker is back.
  try {
    await startMqttConsumer();
  } catch (error) {
    logger.error('MQTT consumer failed to start — continuing without it', error);
  }

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      `Smart Greenhouse API listening on http://localhost:${env.PORT} (env=${env.NODE_ENV})`,
    );
    logger.info(`Swagger UI  → http://localhost:${env.PORT}/api-docs`);
    logger.info(`OpenAPI JSON → http://localhost:${env.PORT}/api-docs.json`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async (err) => {
      if (err) {
        logger.error('Error while closing HTTP server', err);
      }

      try {
        await stopMqttConsumer().catch((e) => logger.warn('MQTT unsubscribe failed', e));
        await disconnectMqtt().catch((e) => logger.warn('MQTT disconnect failed', e));
        await sensorIngestionService
          .flush()
          .catch((e) => logger.warn('Final Influx flush failed', e));
        await disconnectInfluxDB();
        logger.info('Shutdown complete');
        process.exit(err ? 1 : 0);
      } catch (shutdownError) {
        logger.error('Error during shutdown', shutdownError);
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    void shutdown('uncaughtException');
  });
};

bootstrap().catch((error) => {
  logger.error('Failed to start application', error);
  process.exit(1);
});
