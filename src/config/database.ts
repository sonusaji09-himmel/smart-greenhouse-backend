import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

/**
 * Opens the single shared Mongoose connection used by the application.
 *
 * Call this once during application bootstrap, before starting the HTTP server.
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DATABASE,
      serverSelectionTimeoutMS: 10_000,
    });

    logger.info(`MongoDB connected → database="${env.MONGODB_DATABASE}"`);
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    throw error;
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB runtime error', error);
  });
};

/**
 * Gracefully closes the Mongoose connection. Intended for SIGINT/SIGTERM shutdown.
 */
export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
};
