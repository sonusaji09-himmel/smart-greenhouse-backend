import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Zod schema for all environment variables.
 *
 * Every variable consumed by the application is declared here so that:
 *   - it is documented in one place,
 *   - it is validated at startup (fail fast on misconfiguration),
 *   - it is strongly typed wherever it is imported.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().positive().default(8000),

  API_PREFIX: z.string().startsWith('/', 'API_PREFIX must start with "/"').default('/api'),

  API_VERSION: z
    .string()
    .regex(/^v\d+$/, 'API_VERSION must be like "v1", "v2", ...')
    .default('v1'),

  // ── InfluxDB (time-series store) ────────────────────────────────────────
  INFLUX_URL: z.string().url('INFLUX_URL must be a valid URL').default('http://localhost:8086'),
  INFLUX_TOKEN: z.string().min(1, 'INFLUX_TOKEN is required'),
  INFLUX_ORG: z.string().min(1, 'INFLUX_ORG is required'),
  INFLUX_BUCKET: z.string().min(1, 'INFLUX_BUCKET is required').default('greenhouse'),
  INFLUX_MEASUREMENT: z.string().min(1).default('sensor_reading'),

  // ── MQTT broker ─────────────────────────────────────────────────────────
  MQTT_URL: z
    .string()
    .min(1, 'MQTT_URL is required (e.g. mqtt://localhost:1883)')
    .default('mqtt://localhost:1883'),
  MQTT_CLIENT_ID: z.string().min(1).default('smart-greenhouse-backend'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_TOPIC_PREFIX: z.string().min(1).default('greenhouse'),
  /**
   * Wildcard the backend subscribes to. Defaults to the ESP32 firmware's
   * per-field string topics. `+` is a single-level wildcard.
   */
  MQTT_SUBSCRIBE_TOPIC: z.string().min(1).default('esp32s3/smartfarm/+'),
  MQTT_QOS: z.coerce.number().int().min(0).max(2).default(1),
  MQTT_RECONNECT_PERIOD_MS: z.coerce.number().int().nonnegative().default(5_000),
  MQTT_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  // ── ESP32 telemetry ─────────────────────────────────────────────────────
  // The firmware publishes one string per sensor on separate topics and the
  // topic carries no device id, so we assign one here. Readings are combined
  // after a short debounce window.
  /** deviceId assigned to incoming ESP32 readings. */
  ESP32_DEVICE_ID: z.string().min(1).default('esp32-01'),
  /** Debounce window to group the burst of per-field messages into one write. */
  ESP32_FLUSH_MS: z.coerce.number().int().positive().default(2_000),

  // ── Auth (JWT) ──────────────────────────────────────────────────────────
  AUTH_ENABLED: z
    .string()
    .default('false')
    .transform((raw) => raw.toLowerCase() === 'true'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 chars')
    .default('change-me-in-env'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),
  /** Seed admin credentials used by `/auth/login`. For real deployments, wire a user store. */
  ADMIN_EMAIL: z.email('ADMIN_EMAIL must be a valid email').default('admin@greenhouse.local'),
  ADMIN_PASSWORD: z
    .string()
    .min(8, 'ADMIN_PASSWORD must be at least 8 chars')
    .default('ChangeMe123!'),

  // ── CORS ────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((raw) =>
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error(`\nInvalid environment variables:\n${formatted}\n`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
});

export type Env = typeof env;
