# Smart Greenhouse — Real-Time IoT Backend

A Node.js + Express + TypeScript backend for the Smart Greenhouse project. ESP32 devices publish telemetry over **MQTT**; the backend validates readings, stores them in **InfluxDB**, runs **automation rules** (pump, lights, window), exposes **manual actuator control** and **sustained alerts**, and serves real-time APIs (including **SSE**) to a React dashboard.

---

## Pipeline

```
ESP32 ──telemetry──▶ MQTT broker ──subscribe──▶ Backend ──write──▶ InfluxDB
                         ▲                           │
                         │                           ├── automation engine
                         └── commands ◀──────────────├── actuator API (manual)
                                                     ├── alert engine (Flux queries)
                                                     └── REST API + SSE
                                                              │
                                                              ▼
                                                     React dashboard (poll / SSE)
```

1. Device publishes JSON to `greenhouse/{deviceId}/telemetry` (QoS 1).
2. Backend ingests → InfluxDB → evaluates automation → may publish to `greenhouse/{deviceId}/commands`.
3. Dashboard uses `GET /dashboard/overview` (poll) or `GET /dashboard/stream` (SSE).
4. Frontend calls actuator and alert endpoints for manual control and warnings.

---

## Features

| Area | Description |
| ---- | ----------- |
| **Ingestion** | MQTT consumer + HTTP fallback; Zod validation; idempotent writes |
| **Automation** | Pump, LED lights, motorized window from sensor thresholds (R1–R6) |
| **Actuators** | Manual activate / deactivate / stop via REST → MQTT commands (R10–R12) |
| **Manual safety** | Manual **activate** rejected when sensor limits not met (R13) |
| **Empty tank** | Pump blocked when `waterLevel` ≤ 5% if field is present (R15) |
| **Alerts** | Sustained critical conditions queried from Influx history (R14) |
| **Dashboard API** | Latest readings with per-sensor optimal / warning / critical status (R8–R9 backend) |
| **Realtime** | SSE broadcast on each new ingested reading |
| **Auth** | Optional JWT on protected routes |
| **Demo** | Docker (InfluxDB) + HiveMQ Cloud + ESP32 simulator — see [DEMO.md](./DEMO.md) |

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
| Dev Tooling | tsx, ESLint (flat), Prettier, rimraf, concurrently            |

---

## Architecture

Strict MVC-style layering, organised by feature and API version.

```
src/
├── app.ts
├── server.ts                            ← Influx → MQTT → HTTP → graceful shutdown
├── config/
│   ├── env.ts
│   ├── influxdb.ts
│   ├── logger.ts
│   └── openapi.ts
├── mqtt/
│   ├── mqttClient.ts
│   ├── mqttConsumer.ts
│   └── topics.ts
├── middlewares/
│   ├── auth.middleware.ts
│   ├── errorHandler.middleware.ts
│   ├── notFound.middleware.ts
│   ├── requestLogger.middleware.ts
│   └── validate.middleware.ts
├── constants/
│   └── sensorThresholds.ts              ← status, automation, alert thresholds
├── utils/
│   ├── ApiResponse.ts
│   ├── AppError.ts
│   └── asyncHandler.ts
└── api/v1/
    ├── controllers/
    │   ├── auth.controller.ts
    │   ├── sensor.controller.ts
    │   ├── dashboard.controller.ts
    │   ├── actuator.controller.ts
    │   └── alert.controller.ts
    ├── services/
    │   ├── auth.service.ts
    │   ├── sensorIngestion.service.ts
    │   ├── sensorQuery.service.ts
    │   ├── sensorStatus.service.ts
    │   ├── dashboard.service.ts
    │   ├── automationEngine.service.ts
    │   ├── actuatorControl.service.ts
    │   ├── alertEngine.service.ts
    │   └── sseEmitter.service.ts
    ├── validators/
    └── routes/
        ├── health.routes.ts
        ├── auth.routes.ts
        ├── sensor.routes.ts
        ├── dashboard.routes.ts
        ├── actuator.routes.ts
        └── alert.routes.ts
```

### Separation of concerns

- **Controllers** — HTTP I/O only.
- **Services** — business logic; Influx reads/writes, automation, alerts, MQTT commands.
- **Validators** — Zod schemas shared with OpenAPI generation.
- **MQTT** — consumer and command publisher share ingestion and actuator services.
- **Thresholds** — `src/constants/sensorThresholds.ts` (structured for future DB-backed settings).

All routes mount under `${API_PREFIX}/${API_VERSION}` (default `/api/v1`).

---

## MQTT Contract

### Topics

| Direction | Topic | Purpose |
| --------- | ----- | ------- |
| Device → backend | `greenhouse/{deviceId}/telemetry` | Sensor readings |
| Backend → device | `greenhouse/{deviceId}/commands` | Actuator commands |
| Device → backend | `greenhouse/{deviceId}/status` | Online/LWT (reserved; not wired yet) |

Prefix is configurable via `MQTT_TOPIC_PREFIX`. Backend subscribes to `greenhouse/+/telemetry`.

### Telemetry payload (JSON)

```json
{
  "temperature": 24.5,
  "soilMoisture": 38.0,
  "lightLevel": 60.0,
  "waterLevel": 75.0,
  "timestamp": "2026-04-20T10:30:00Z",
  "deviceId": "esp32-01",
  "messageId": "esp32-01-00017345"
}
```

- `deviceId` may be omitted — inferred from the topic.
- `timestamp` optional — server time used if missing.
- `messageId` optional — deduplicates redeliveries (60 s in-process cache).
- `waterLevel` optional — tank level (%); used for pump safety (R15).

### Command payload (backend → device)

Published on manual or automatic actuation:

```json
{
  "actuator": "pump",
  "action": "activate",
  "source": "auto",
  "timestamp": "2026-04-20T10:30:05.000Z"
}
```

`actuator`: `pump` | `lights` | `window`  
`action`: `activate` | `deactivate` | `stop`  
`source`: `manual` | `auto`

### Reliability

- QoS 1, persistent session, auto-resubscribe on reconnect.
- Influx deduplicates on `(measurement, tags, timestamp)`.
- Per-message validation failures are logged; the consumer keeps running.

---

## InfluxDB Schema

```
measurement: sensor_reading     (INFLUX_MEASUREMENT)
tags:
  - deviceId
fields:
  - temperature   (float, °C)
  - soilMoisture  (float, %)
  - lightLevel    (float, %)
  - waterLevel    (float, %, optional)
timestamp: reading time (ISO-8601 → ns)
```

Writes are batched (200 points / 1 s flush). `deviceId` as a tag keeps per-device queries efficient.

---

## Automation & Control

Thresholds are defined in `src/constants/sensorThresholds.ts` (`AUTOMATION_THRESHOLDS`). After each ingested reading, `automationEngine.service.ts` may send MQTT commands.

| Actuator | Activate (auto) | Deactivate (auto) |
| -------- | ----------------- | ----------------- |
| **Pump** | soil moisture &lt; 50% | soil moisture &gt; 80% |
| **Lights** | light &lt; 30% | light &gt; 70% |
| **Window** | temp &gt; 27°C | temp &lt; 24°C |

**Manual control (R10–R12):** `POST /actuators/{pump|lights|window}/activate|deactivate|stop?deviceId=...`

**Manual activate safety (R13):** activate is rejected with HTTP 409 if limits are not met (e.g. pump only when soil &lt; 50%).

**Empty tank (R15):** pump activate rejected when `waterLevel` ≤ 5%.

**Manual override:** auto commands are skipped for 2 minutes after a manual command on the same actuator.

---

## Sustained Alerts (R14)

`GET /alerts` evaluates historical data in InfluxDB (not single readings). An alert fires only if the condition held for the full window:

| Key | Condition | Duration |
| --- | --------- | -------- |
| `temperature-high` | temperature &gt; 30°C | 5 hours |
| `soil-dry` | soil moisture &lt; 40% | 96 hours (4 days) |
| `soil-wet` | soil moisture &gt; 80% | 96 hours (4 days) |
| `darkness` | light &lt; 20% | 6 hours |

Short demos often return `count: 0` until enough bad data exists in Influx. See [DEMO.md](./DEMO.md) for the full stack; alert backfill is optional for presentations.

---

## Quick Start (Demo)

Requires **Docker**, **Node.js 20+**, and a **HiveMQ Cloud** cluster.

```bash
npm install
npm run demo:setup    # copies .env.demo → .env (once)
# Edit .env — set MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD
npm run demo:start    # InfluxDB + backend + ESP32 simulator (HiveMQ Cloud)
```

- API: [http://localhost:8000](http://localhost:8000)
- Swagger: [http://localhost:8000/api-docs](http://localhost:8000/api-docs)
- Influx UI: [http://localhost:8086](http://localhost:8086) (admin / greenhouse123 in demo)

Stop: `Ctrl+C` then `npm run demo:stop`.

Full walkthrough, actuator curl examples, and troubleshooting: **[DEMO.md](./DEMO.md)**.

---

## Setup (without demo)

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- HiveMQ Cloud cluster (or any MQTT 3.1.1 broker with TLS)
- InfluxDB 2.x with bucket and token

### Install & configure

```bash
npm install
cp .env.example .env
# Set INFLUX_TOKEN, MQTT_URL, etc.
```

### Run

```bash
npm run dev          # development (tsx watch)
npm run build && npm start   # production
```

---

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Start with auto-reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled app |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run demo:setup` | Copy demo `.env` |
| `npm run demo:infra` | Start Docker (InfluxDB) |
| `npm run demo:simulate` | ESP32 MQTT simulator only |
| `npm run demo:start` | Full demo (infra + backend + simulator) |
| `npm run demo:stop` | Stop Docker stack |

---

## Configuration

Loaded via `dotenv` and validated with Zod at startup.

### Application

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `NODE_ENV` | `development` | `development` / `test` / `production` |
| `PORT` | `8000` | HTTP port |
| `API_PREFIX` | `/api` | Base path |
| `API_VERSION` | `v1` | Version segment |
| `CORS_ORIGINS` | localhost:3000,5173 | Comma-separated allowlist |
| `LOG_LEVEL` | `info` | Winston level |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_MAX` | `120` | Max requests per IP per window |

### InfluxDB

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `INFLUX_URL` | `http://localhost:8086` | InfluxDB v2 URL |
| `INFLUX_TOKEN` | — | **Required** write+read token |
| `INFLUX_ORG` | — | **Required** organisation |
| `INFLUX_BUCKET` | `greenhouse` | Bucket name |
| `INFLUX_MEASUREMENT` | `sensor_reading` | Measurement name |

### MQTT

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `MQTT_URL` | `mqtts://…:8883` | Broker URL (`mqtts://` for HiveMQ Cloud TLS) |
| `MQTT_CLIENT_ID` | `smart-greenhouse-backend` | Client id |
| `MQTT_USERNAME` | — | Broker username (required for HiveMQ Cloud) |
| `MQTT_PASSWORD` | — | Broker password (required for HiveMQ Cloud) |
| `MQTT_TOPIC_PREFIX` | `greenhouse` | Topic namespace |
| `MQTT_SUBSCRIBE_TOPIC` | `greenhouse/+/telemetry` | Subscribe pattern |
| `MQTT_QOS` | `1` | 0 / 1 / 2 |
| `MQTT_RECONNECT_PERIOD_MS` | `5000` | Reconnect interval |
| `MQTT_CONNECT_TIMEOUT_MS` | `15000` | Connect timeout |

### Auth

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `AUTH_ENABLED` | `false` | Require JWT on guarded routes |
| `JWT_SECRET` | — | ≥ 16 characters in production |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `ADMIN_EMAIL` | `admin@greenhouse.local` | Seed admin |
| `ADMIN_PASSWORD` | `ChangeMe123!` | Seed password |

When `AUTH_ENABLED=true`, send `Authorization: Bearer <jwt>` on guarded endpoints. Demo uses `AUTH_ENABLED=false`.

---

## REST API

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/health` | — | Liveness; Influx + MQTT status |
| POST | `/auth/login` | — | JWT from email/password |
| POST | `/sensors/data` | — | HTTP ingestion fallback |
| GET | `/sensors/latest` | opt. | Latest reading (`deviceId` optional) |
| GET | `/sensors/history` | opt. | Raw points (`from`/`to` or `window`) |
| GET | `/sensors/aggregate` | opt. | Windowed mean/min/max/median/sum/last |
| GET | `/dashboard/overview` | opt. | Latest values + per-sensor status |
| GET | `/dashboard/stream` | opt. | SSE stream of new readings |
| GET | `/actuators/state` | opt. | Last known actuator states |
| POST | `/actuators/{pump\|lights\|window}/activate` | opt. | Manual/auto activate → MQTT |
| POST | `/actuators/{pump\|lights\|window}/deactivate` | opt. | Deactivate → MQTT |
| POST | `/actuators/{pump\|lights\|window}/stop` | opt. | Stop (hold position) → MQTT |
| GET | `/alerts` | opt. | Active sustained-threshold alerts |

**Auth:** `authGuard` on marked routes when `AUTH_ENABLED=true`.

**Swagger:** [`/api-docs`](http://localhost:8000/api-docs) · OpenAPI JSON: [`/api-docs.json`](http://localhost:8000/api-docs.json)

---

## Response Envelopes

### Success

```json
{
  "success": true,
  "message": "Optional context",
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "message": "Request validation failed",
  "code": "VALIDATION_ERROR",
  "statusCode": 400,
  "details": [{ "path": "query.window", "message": "...", "code": "invalid_string" }]
}
```

Manual actuator activate may return **409** when safety rules block the command.

---

## Example Requests

Publish via any MQTT client connected to HiveMQ Cloud:

```bash
# Example (replace host/credentials with your HiveMQ cluster)
mosquitto_pub -h your-cluster.s1.eu.hivemq.cloud -p 8883 --capath /etc/ssl/certs/ \
  -u your-username -P your-password -q 1 \
  -t "greenhouse/esp32-01/telemetry" \
  -m '{"temperature":24.5,"soilMoisture":38,"lightLevel":60,"waterLevel":75,"messageId":"m-0001"}'
```

### HTTP ingestion

```bash
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":24.5,"soilMoisture":38,"lightLevel":60,"deviceId":"esp32-01"}'
```

### Dashboard overview

```bash
curl "http://localhost:8000/api/v1/dashboard/overview?deviceId=esp32-01"
```

### Dashboard SSE (browser / curl)

```bash
curl -N "http://localhost:8000/api/v1/dashboard/stream"
```

### Actuator control

```bash
curl -X POST "http://localhost:8000/api/v1/actuators/pump/activate?deviceId=esp32-01"
curl -X POST "http://localhost:8000/api/v1/actuators/lights/deactivate?deviceId=esp32-01"
curl -X POST "http://localhost:8000/api/v1/actuators/window/stop?deviceId=esp32-01"
curl "http://localhost:8000/api/v1/actuators/state"
```

### Alerts

```bash
curl "http://localhost:8000/api/v1/alerts?deviceId=esp32-01"
```

### History & aggregate

```bash
curl "http://localhost:8000/api/v1/sensors/history?deviceId=esp32-01&window=24h&limit=500"
curl "http://localhost:8000/api/v1/sensors/aggregate?deviceId=esp32-01&window=24h&every=1h&fn=mean"
```

### Auth (when enabled)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenhouse.local","password":"ChangeMe123!"}'
```

---

## Threshold Reference

### Dashboard sensor status

Used by `sensorStatus.service.ts` for optimal / warning / critical on each tile.

| Sensor | Unit | Critical Low | Warning Low | Optimal | Warning High | Critical High |
| ------ | ---- | -------------- | ----------- | ------- | -------------- | ------------- |
| Temperature | °C | &lt; 10 | 10–18 | 18–28 | 28–40 | &gt; 40 |
| Soil moisture | % | &lt; 20 | 20–40 | 40–70 | 70–90 | &gt; 90 |
| Light | % | &lt; 5 | 5–30 | 30–80 | 80–100 | &gt; 100 |

### Automation (actuator control)

| Rule | Threshold |
| ---- | --------- |
| Pump on | soil &lt; 50% |
| Pump off | soil &gt; 80% |
| Lights on | light &lt; 30% |
| Lights off | light &gt; 70% |
| Window open | temp &gt; 27°C |
| Window close | temp &lt; 24°C |
| Tank block pump | `waterLevel` ≤ 5% |

All defined in `src/constants/sensorThresholds.ts`.

---

## Scalability & Production

- **Multiple devices** — `greenhouse/+/telemetry` wildcard; `deviceId` tag in Influx.
- **Write batching** — 200 points / 1 s with retries.
- **Horizontal scaling** — multiple backend instances need distinct `MQTT_CLIENT_ID`; consider MQTT 5 shared subscriptions for ingest.
- **Observability** — structured Winston logs; MQTT and write events logged.
- **Graceful shutdown** — SIGINT/SIGTERM drains HTTP, unsubscribes MQTT, flushes Influx (10 s cap).

Demo stack uses a fixed InfluxDB token on localhost and HiveMQ Cloud credentials in `.env` — not for production without `AUTH_ENABLED=true` and strong secrets.

---

## Production (EC2 + HiveMQ Cloud)

Recommended layout:

- **HiveMQ Cloud** — MQTT broker (ESP32 + backend both connect via `mqtts://…:8883`)
- **EC2** — Node.js backend + InfluxDB (Influx bound to `127.0.0.1:8086`, never public)
- **Security group** — inbound `22` (your IP), `443` (API via nginx/Caddy); do **not** open `1883` or `8086`
- **`.env` on EC2** — `NODE_ENV=production`, `INFLUX_URL=http://127.0.0.1:8086`, `MQTT_URL=mqtts://…:8883`, `AUTH_ENABLED=true`, strong `JWT_SECRET`, `CORS_ORIGINS=<dashboard URL>`
- **Process management** — PM2/systemd for Node; Docker for InfluxDB with EBS-backed volume

---

## Roadmap

- [ ] Device online/offline via MQTT `status` / LWT topic
- [ ] Alert history, clear state, and notification webhooks
- [ ] Automated tests (Vitest + Supertest + Testcontainers)
- [ ] Frontend dashboard integration (separate React repo; consumes APIs documented here)

---

## Related docs

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — system flow, HiveMQ, EC2, ESP32, and data retrieval explained with diagrams
- **[DEMO.md](./DEMO.md)** — end-to-end demo, simulator scenarios, actuator timing, troubleshooting
