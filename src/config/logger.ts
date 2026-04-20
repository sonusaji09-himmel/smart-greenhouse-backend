import { createLogger, format, transports } from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors, splat, json } = format;

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  splat(),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const base = `${ts} [${level}] ${stack ?? message}`;
    return `${base}${metaString}`;
  }),
);

const productionFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: env.isProduction ? productionFormat : developmentFormat,
  defaultMeta: { service: 'smart-greenhouse-api' },
  transports: [new transports.Console()],
  exitOnError: false,
});

/**
 * Stream adapter for morgan — pipes HTTP access logs through winston.
 */
export const httpLogStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};
