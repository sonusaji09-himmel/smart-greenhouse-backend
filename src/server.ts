import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './config/logger';

/**
 * Application entry point.
 *
 * Responsibilities:
 *   1. Open the database connection.
 *   2. Build the Express app.
 *   3. Start listening on the configured port.
 *   4. Wire graceful shutdown for SIGINT / SIGTERM and fatal errors.
 */
const bootstrap = async (): Promise<void> => {
  await connectDatabase();

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
        process.exit(1);
      }

      try {
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (shutdownError) {
        logger.error('Error during database shutdown', shutdownError);
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
