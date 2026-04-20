# Smart Greenhouse — Real-Time IoT Backend

A production-grade Node.js + Express + TypeScript backend that consumes telemetry from ESP32 devices over **MQTT**, persists it in **InfluxDB** as time-series data, and serves real-time + aggregated query APIs to a React frontend.

---

## Pipeline

```
ESP32 ──publish──▶ MQTT broker ──subscribe──▶ Backend ──write──▶ InfluxDB
                                                  │
                          ┌───────────────────────┘
                          ▼
                     REST API (Express)
                          │
                          ▼
                  React frontend (polls / SSE)
```

- Each ESP32 publishes a JSON payload every ~5–30s to `greenhouse/{deviceId}/telemetry`.
- The backend subscribes with QoS-1, validates the payload with Zod, and writes a point to InfluxDB.
- The React dashboard hits `GET /dashboard/overview` every ~10s, and `GET /sensors/history` or `/aggregate` for charts.

---

## Tech Stack

| Layer       | Technology                                                    |
| ----------- | ------------------------------------------------------------- |
| Runtime     | Node.js ≥ 20                                                  |
| Language    | TypeScript 5                                                  |
| Framework   | Express 5                                                     |
| Messaging   | MQTT (`mqtt.js`)                                              |
| Time-series | InfluxDB 2.x (`@influxdata/influxdb-client`)                  |
| Validation  | Zod 4                                                         |
| Auth        | JWT (`jsonwebtoken`) + bcrypt                                 |
| API Docs    | OpenAPI 3.1 via `@asteasolutions/zod-to-openapi` + Swagger UI |
| Logging     | Winston + Morgan                                              |
| Security    | Helmet, CORS allowlist, express-rate-limit, 1 MB body cap     |
| Dev Tooling | tsx, ESLint (flat), Prettier, rimraf                          |

---

## Architecture

Strict MVC-style layering, organised by feature and API version so the project scales to many resources and devices.

```
src/
├── app.ts                               ← Express factory (middleware chain)
├── server.ts                            ← Bootstrap: Influx → MQTT → HTTP → shutdown
├── config/
│   ├── env.ts                           ← Zod-validated env loader
│   ├── influxdb.ts                      ← Influx client + write/query APIs
│   ├── logger.ts                        ← Winston + morgan pipe
│   └── openapi.ts                       ← OpenAPI registry + generator + bearerAuth scheme
├── mqtt/
│   ├── mqttClient.ts                    ← Resilient MQTT connection (auto-reconnect)
│   ├── mqttConsumer.ts                  ← Subscribe → validate → ingest loop
│   └── topics.ts                        ← Topic naming + deviceId parser
├── middlewares/
│   ├── auth.middleware.ts               ← JWT guard (bypassed if AUTH_ENABLED=false)
│   ├── errorHandler.middleware.ts       ← Global error → ErrorEnvelope JSON
│   ├── notFound.middleware.ts           ← 404 → AppError
│   ├── requestLogger.middleware.ts      ← morgan → winston
│   └── validate.middleware.ts           ← Zod request validator factory
├── constants/
│   └── sensorThresholds.ts              ← Sensor ranges, units, status literals
├── utils/
│   ├── ApiResponse.ts
│   ├── AppError.ts
│   └── asyncHandler.ts
└── api/
    └── v1/
        ├── controllers/                 ← HTTP I/O only
        │   ├── auth.controller.ts
        │   ├── sensor.controller.ts
        │   └── dashboard.controller.ts
        ├── services/                    ← All business logic lives here
        │   ├── auth.service.ts
        │   ├── sensorIngestion.service.ts   (Influx writes, idempotent)
        │   ├── sensorQuery.service.ts       (Flux queries, aggregations)
        │   ├── sensorStatus.service.ts      (pure threshold mapper)
        │   └── dashboard.service.ts
        ├── validators/                  ← Zod schemas (double as OpenAPI source)
        │   ├── zodOpenApi.ts
        │   ├── common.validator.ts
        │   ├── auth.validator.ts
        │   ├── sensor.validator.ts
        │   └── dashboard.validator.ts
        └── routes/                      ← Route wiring + OpenAPI registration
            ├── index.ts
            ├── health.routes.ts
            ├── auth.routes.ts
            ├── sensor.routes.ts
            └── dashboard.routes.ts
```

### Separation of concerns

- **Controllers** only deal with the HTTP cycle.
- **Services** own all business logic. They are the only layer that may talk to InfluxDB.
- **Validators** are Zod schemas that back request validation *and* OpenAPI generation — one source of truth.
- **MQTT module** runs as a side-process inside the Node runtime; the MQTT consumer shares the same `sensorIngestionService` as the HTTP fallback endpoint, so both paths land exactly one code path into InfluxDB.
- **Config** encapsulates env, logger, Influx client, and OpenAPI registry.

### API versioning

All routes mount under `${API_PREFIX}/${API_VERSION}` (default `/api/v1`). A `v2` is a new `src/api/v2/...` tree + one line in the bootstrap — no existing code changes.

---

## MQTT Contract

**Subscribe topic (backend):** `greenhouse/+/telemetry` — wildcard matches any device.
**Publish topic (ESP32):** `greenhouse/{deviceId}/telemetry` with QoS 1.

**Payload (JSON):**

```json
{
  "temperature": 24.5,
  "humidity": 62.0,
  "soilMoisture": 38.0,
  "lightLevel": 850.0,
  "timestamp": "2026-04-20T10:30:00Z",
  "deviceId": "esp32-01",
  "messageId": "esp32-01-00017345"
}
```

- `deviceId` may be omitted — the backend infers it from the topic.
- `timestamp` is optional; if missing, server time is used.
- `messageId` is optional but recommended — it short-circuits duplicate redeliveries.

### Reliability & idempotency

- The MQTT client keeps `clean: false` so QoS-1 messages survive brief disconnects and are redelivered after reconnect.
- `reconnectPeriod` + `resubscribe` handle broker flaps automatically; each state change is logged.
- Influx deduplicates on `(measurement, tag-set, timestamp)`, so redelivered points collapse to a single row.
- An in-process LRU cache of `deviceId::messageId` (60 s TTL) additionally drops immediate retransmits before they hit the network.
- All message failures (bad JSON, failed validation, write error) are logged with context but **never crash the consumer** — the pipeline keeps draining.

---

## InfluxDB Schema

```
measurement: sensor_reading     (configurable via INFLUX_MEASUREMENT)
tags:
  - deviceId
fields:
  - temperature   (float, °C)
  - humidity      (float, %)
  - soilMoisture  (float, %)
  - lightLevel    (float, lux)
timestamp: reading time (ISO-8601 → ns)
```

Because `deviceId` is a tag (indexed), queries-per-device are O(log n). Writes are batched (200 points / 1 s flush) to sustain multi-device high-frequency publishing.

---

## Setup

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- An MQTT broker (e.g. `mosquitto`, HiveMQ, EMQX)
- InfluxDB 2.x running with a bucket and token

### Install & configure

```bash
npm install
cp .env.example .env
# Fill in INFLUX_TOKEN, MQTT credentials, etc.
```

### Run locally

```bash
# Dev (auto-reload)
npm run dev

# Prod
npm run build
npm start
```

API: `http://localhost:8000`
Swagger UI: `http://localhost:8000/api-docs`

### Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start with `tsx watch` (auto-reload)     |
| `npm run build`     | Compile TypeScript to `dist/`            |
| `npm start`         | Run the compiled app                     |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm run lint`      | ESLint flat config                       |
| `npm run format`    | Prettier                                 |

---

## Configuration

All configuration is loaded via `dotenv` and validated with Zod at startup — invalid values cause a clear fail-fast error.

### Application

| Variable               | Default         | Description                                |
| ---------------------- | --------------- | ------------------------------------------ |
| `NODE_ENV`             | `development`   | `development` / `test` / `production`      |
| `PORT`                 | `8000`          | HTTP port                                  |
| `API_PREFIX`           | `/api`          | Base path prefix                           |
| `API_VERSION`          | `v1`            | Version segment                            |
| `CORS_ORIGINS`         | localhost:3000,5173 | Comma-separated allowlist              |
| `LOG_LEVEL`            | `info`          | `error` / `warn` / `info` / `http` / `debug` |
| `RATE_LIMIT_WINDOW_MS` | `60000`         | Rate-limit window                          |
| `RATE_LIMIT_MAX`       | `120`           | Max requests per window per IP             |

### InfluxDB

| Variable             | Default                  | Description                          |
| -------------------- | ------------------------ | ------------------------------------ |
| `INFLUX_URL`         | `http://localhost:8086`  | InfluxDB v2 HTTP URL                 |
| `INFLUX_TOKEN`       | —                        | **Required.** Write+read token       |
| `INFLUX_ORG`         | —                        | **Required.** Organisation name      |
| `INFLUX_BUCKET`      | `greenhouse`             | Bucket for sensor data               |
| `INFLUX_MEASUREMENT` | `sensor_reading`         | Measurement name                     |

### MQTT

| Variable                   | Default                       | Description                                  |
| -------------------------- | ----------------------------- | -------------------------------------------- |
| `MQTT_URL`                 | `mqtt://localhost:1883`       | Broker URL (`mqtt://`, `mqtts://`, `ws://`)  |
| `MQTT_CLIENT_ID`           | `smart-greenhouse-backend`    | Unique client id                             |
| `MQTT_USERNAME`            | —                             | Optional                                     |
| `MQTT_PASSWORD`            | —                             | Optional                                     |
| `MQTT_TOPIC_PREFIX`        | `greenhouse`                  | Topic namespace                              |
| `MQTT_SUBSCRIBE_TOPIC`     | `greenhouse/+/telemetry`      | Backend subscription pattern                 |
| `MQTT_QOS`                 | `1`                           | 0 / 1 / 2                                    |
| `MQTT_RECONNECT_PERIOD_MS` | `5000`                        | Auto-reconnect cadence                       |
| `MQTT_CONNECT_TIMEOUT_MS`  | `15000`                       | Initial connect timeout                      |

### Auth

| Variable         | Default                    | Description                                     |
| ---------------- | -------------------------- | ----------------------------------------------- |
| `AUTH_ENABLED`   | `false`                    | Enforce JWT on read endpoints                   |
| `JWT_SECRET`     | —                          | ≥ 16 chars. Change in production                |
| `JWT_EXPIRES_IN` | `1d`                       | `jsonwebtoken` duration string                  |
| `ADMIN_EMAIL`    | `admin@greenhouse.local`   | Seed admin account for `/auth/login`            |
| `ADMIN_PASSWORD` | `ChangeMe123!`             | Seed admin password (hashed in memory at boot)  |

---

## REST API

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint               | Auth  | Description                                         |
| ------ | ---------------------- | ----- | --------------------------------------------------- |
| GET    | `/health`              | —     | Liveness + Influx + MQTT status                     |
| POST   | `/auth/login`          | —     | Exchange email/password for a JWT                   |
| POST   | `/sensors/data`        | —     | HTTP fallback ingestion (primary path is MQTT)      |
| GET    | `/sensors/latest`      | opt.  | Most recent reading (optionally per `deviceId`)     |
| GET    | `/sensors/history`     | opt.  | Raw points in a time range (`from/to` or `window`)  |
| GET    | `/sensors/aggregate`   | opt.  | Windowed `mean/min/max/median/sum/last`             |
| GET    | `/dashboard/overview`  | opt.  | Latest reading with per-sensor status               |

**Auth** is enforced on marked endpoints only when `AUTH_ENABLED=true`. Send `Authorization: Bearer <jwt>`.

### Swagger UI

- Interactive docs: [`/api-docs`](http://localhost:8000/api-docs)
- Raw OpenAPI 3.1 JSON: [`/api-docs.json`](http://localhost:8000/api-docs.json)

The spec is auto-generated from the same Zod schemas that validate requests, so docs can never drift.

---

## Response Envelopes

### Success

```json
{
  "success": true,
  "message": "Optional human-readable context",
  "data": { /* endpoint-specific payload */ }
}
```

### Error

```json
{
  "success": false,
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "statusCode": 400,
  "details": [
    { "path": "query.window", "message": "window must look like 30s / 15m / 1h / 7d", "code": "invalid_string" }
  ]
}
```

---

## Example Requests

### 1 — Publish from an ESP32 (simulated with `mosquitto_pub`)

```bash
mosquitto_pub -h localhost -p 1883 -q 1 \
  -t "greenhouse/esp32-01/telemetry" \
  -m '{"temperature":24.5,"humidity":62,"soilMoisture":38,"lightLevel":850,"messageId":"m-0001"}'
```

The backend logs `MQTT message ingested` and the point is flushed to InfluxDB within ~1 s.

### 2 — HTTP ingestion fallback

```bash
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":24.5,"humidity":62,"soilMoisture":38,"lightLevel":850,"deviceId":"esp32-01"}'
```

### 3 — Latest reading

```bash
curl "http://localhost:8000/api/v1/sensors/latest?deviceId=esp32-01"
```

### 4 — 24-hour history

```bash
curl "http://localhost:8000/api/v1/sensors/history?deviceId=esp32-01&window=24h&limit=500"
```

### 5 — Hourly averages for the last day

```bash
curl "http://localhost:8000/api/v1/sensors/aggregate?deviceId=esp32-01&window=24h&every=1h&fn=mean"
```

### 6 — Dashboard overview

```bash
curl "http://localhost:8000/api/v1/dashboard/overview?deviceId=esp32-01"
```

```json
{
  "success": true,
  "data": {
    "deviceId": "esp32-01",
    "temperature":  { "value": 24.5, "unit": "°C",  "status": "optimal" },
    "humidity":     { "value": 62,   "unit": "%",   "status": "optimal" },
    "soilMoisture": { "value": 38,   "unit": "%",   "status": "warning" },
    "light":        { "value": 850,  "unit": "lux", "status": "optimal" },
    "lastUpdated":  "2026-04-20T10:30:00.000Z"
  }
}
```

### 7 — Authenticate (when `AUTH_ENABLED=true`)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenhouse.local","password":"ChangeMe123!"}'

# → use the returned token:
curl -H "Authorization: Bearer <jwt>" \
     "http://localhost:8000/api/v1/sensors/latest"
```

---

## Threshold Reference

| Sensor        | Unit | Critical Low | Warning Low | Optimal Range | Warning High | Critical High |
| ------------- | ---- | ------------ | ----------- | ------------- | ------------ | ------------- |
| Temperature   | °C   | < 10         | 10 – 18     | 18 – 28       | 28 – 40      | > 40          |
| Humidity      | %    | < 20         | 20 – 50     | 50 – 75       | 75 – 90      | > 90          |
| Soil Moisture | %    | < 20         | 20 – 40     | 40 – 70       | 70 – 90      | > 90          |
| Light         | lux  | < 200        | 200 – 500   | 500 – 2000    | 2000 – 5000  | > 5000        |

Thresholds live in `src/constants/sensorThresholds.ts` and are consumed by `sensorStatus.service.ts`. They can be moved behind a DB-backed settings service later without touching controllers.

---

## Scalability & Production Notes

- **Multiple devices** — the subscribe pattern `greenhouse/+/telemetry` handles any number of devices; tag-based Influx schema keeps per-device queries fast.
- **High-frequency ingest** — write batching (200 points / 1 s, retries with backoff) pushes the throughput ceiling into the thousands of points/sec on a single node.
- **Horizontal scaling** — MQTT is pub-sub, so several backend replicas can run behind a load balancer; assign each its own `MQTT_CLIENT_ID` and make the topic shared (broker-dependent: e.g. MQTT 5 shared subscriptions `$share/group/greenhouse/+/telemetry`).
- **Reliability** — MQTT session persistence + Influx retry + in-memory idempotency cache together give at-least-once delivery with exactly-once observable state.
- **Observability** — Winston JSON logs in prod; every MQTT state change, write batch, and subscription is logged for triage.
- **Graceful shutdown** — SIGINT/SIGTERM drains HTTP, unsubscribes MQTT, flushes pending writes, closes Influx — all within a hard 10 s ceiling.

---

## Roadmap

- Server-Sent Events stream (`GET /sensors/stream`) for zero-poll dashboards
- `POST /devices/commands` (backend → `greenhouse/{id}/commands`)
- Device LWT / status topic wiring
- Alerts history endpoint + webhook sink
- Automated tests (Vitest + Supertest + Testcontainers for broker & Influx)
