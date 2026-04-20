# Smart Greenhouse — Backend API

A production-grade Node.js + Express + TypeScript backend that ingests sensor data from an ESP32, persists it in MongoDB, and serves an aggregated overview (with computed optimal/warning/critical status) to a React dashboard.

---

## How It Works

```
ESP32 (sensors)  →  POST /api/v1/sensors/data      →  Backend  →  MongoDB
React Dashboard  ←  GET  /api/v1/dashboard/overview ←  Backend  ←  MongoDB
```

- The ESP32 sends temperature, humidity, soil moisture, and light readings every ~30 seconds.
- The backend validates, stores, and serves them with a computed status.
- The React frontend polls the dashboard endpoint every ~10 seconds to display live data.

---

## Tech Stack

| Layer              | Technology                                               |
| ------------------ | -------------------------------------------------------- |
| Runtime            | Node.js ≥ 20                                             |
| Language           | TypeScript 5                                             |
| Framework          | Express 5                                                |
| Database           | MongoDB (Mongoose ODM)                                   |
| Validation         | Zod                                                      |
| API Docs           | OpenAPI 3.1 via `@asteasolutions/zod-to-openapi` + Swagger UI |
| Logging            | Winston + Morgan                                         |
| Security           | Helmet, CORS, express-rate-limit                         |
| Dev Tooling        | tsx, ESLint (flat config), Prettier, rimraf              |

---

## Architecture

The project follows a strict MVC-style layering, organized by feature and API version so it scales cleanly to many resources:

```
src/
├── app.ts                               ← Express app factory (middleware chain)
├── server.ts                            ← Entry point (bootstrap, shutdown)
├── config/
│   ├── env.ts                           ← Zod-validated environment loader
│   ├── database.ts                      ← Mongoose connection + lifecycle
│   ├── logger.ts                        ← Winston logger + morgan stream
│   └── openapi.ts                       ← Central OpenAPI registry + generator
├── constants/
│   └── sensorThresholds.ts              ← Sensor ranges, units, status literals
├── middlewares/
│   ├── errorHandler.middleware.ts       ← Global error → ErrorEnvelope JSON
│   ├── notFound.middleware.ts           ← 404 → AppError forwarder
│   ├── requestLogger.middleware.ts      ← morgan → winston pipe
│   └── validate.middleware.ts           ← Zod request validator factory
├── utils/
│   ├── ApiResponse.ts                   ← success/error envelope types
│   ├── AppError.ts                      ← Typed operational errors
│   └── asyncHandler.ts                  ← async → next(err) adapter
└── api/
    └── v1/
        ├── controllers/                 ← HTTP I/O only (no business logic)
        │   ├── sensor.controller.ts
        │   └── dashboard.controller.ts
        ├── services/                    ← Business logic (pure, testable)
        │   ├── sensor.service.ts
        │   ├── dashboard.service.ts
        │   └── sensorStatus.service.ts
        ├── models/                      ← Mongoose schemas / data layer
        │   └── sensorReading.model.ts
        ├── validators/                  ← Zod schemas (shared with OpenAPI)
        │   ├── zodOpenApi.ts
        │   ├── common.validator.ts
        │   ├── sensor.validator.ts
        │   └── dashboard.validator.ts
        └── routes/                      ← Route wiring + OpenAPI registration
            ├── index.ts
            ├── health.routes.ts
            ├── sensor.routes.ts
            └── dashboard.routes.ts
```

### Separation of concerns

- **Controllers** only deal with the HTTP cycle: parse the request (already validated by middleware), delegate to a service, shape the response.
- **Services** own all business logic. They are the only layer that may talk to models.
- **Models** describe the data shape and persistence rules. They expose typed documents via Mongoose.
- **Validators** are Zod schemas that do double duty: runtime validation of `body` / `query` / `params` and auto-generated OpenAPI documentation. One source of truth.
- **Middlewares** handle cross-cutting concerns: security headers, CORS, compression, rate limiting, logging, validation, 404, and centralized error handling.
- **Config** encapsulates environment, logger, database, and the OpenAPI registry.

### API versioning

All routes are mounted under `${API_PREFIX}/${API_VERSION}` (default `/api/v1`). Adding a `v2` is a matter of introducing `src/api/v2/...` and mounting a second router — no existing code changes.

---

## Setup

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- MongoDB running locally (or reachable via `MONGODB_URI`)

### Install & configure

```bash
npm install
cp .env.example .env
# (edit .env if needed)
```

### Scripts

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start with `tsx watch` (auto-reload)                 |
| `npm run build`     | Compile TypeScript to `dist/`                        |
| `npm start`         | Run the compiled app from `dist/`                    |
| `npm run typecheck` | Run `tsc --noEmit`                                   |
| `npm run lint`      | Run ESLint (flat config)                             |
| `npm run format`    | Run Prettier                                         |

### Start the server

Development:

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

The API is available at `http://localhost:8000`.

---

## Configuration

All configuration is loaded via `dotenv` and validated with Zod on startup — invalid or missing values cause a clear startup error.

| Variable               | Default                                           | Description                              |
| ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| `NODE_ENV`             | `development`                                     | One of `development`, `test`, `production` |
| `PORT`                 | `8000`                                            | HTTP port                                |
| `API_PREFIX`           | `/api`                                            | Base path prefix                         |
| `API_VERSION`          | `v1`                                              | Version segment                          |
| `MONGODB_URI`          | —                                                 | Connection string (required)             |
| `MONGODB_DATABASE`     | —                                                 | Database name (required)                 |
| `CORS_ORIGINS`         | `http://localhost:3000,http://localhost:5173`     | Comma-separated allowed origins          |
| `LOG_LEVEL`            | `info`                                            | `error` / `warn` / `info` / `http` / `debug` |
| `RATE_LIMIT_WINDOW_MS` | `60000`                                           | Rate-limit window                        |
| `RATE_LIMIT_MAX`       | `120`                                             | Max requests per window per IP           |

---

## API

### Base URL

```
http://localhost:8000/api/v1
```

### Endpoints

| Method | Endpoint              | Called By | Description                                   |
| ------ | --------------------- | --------- | --------------------------------------------- |
| GET    | `/health`             | Ops       | Liveness + DB connectivity probe              |
| POST   | `/sensors/data`       | ESP32     | Ingest a sensor reading                       |
| GET    | `/dashboard/overview` | React     | Latest reading with computed per-sensor status |

### Interactive documentation

Swagger UI: [`http://localhost:8000/api-docs`](http://localhost:8000/api-docs)

Raw OpenAPI 3.1 JSON: [`http://localhost:8000/api-docs.json`](http://localhost:8000/api-docs.json)

The spec is auto-generated from the same Zod schemas used for request validation, so docs can never drift out of sync with the real contract.

---

## Response Envelopes

Every endpoint returns a consistent shape.

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
    { "path": "body.temperature", "message": "Temperature is required", "code": "invalid_type" }
  ]
}
```

`details` carries validation issues, Mongoose errors, or any structured context provided when the `AppError` was thrown.

---

## Example Requests

### Ingest a reading (simulate the ESP32)

```bash
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 24.5,
    "humidity": 62.0,
    "soilMoisture": 38.0,
    "lightLevel": 850.0
  }'
```

```json
{
  "success": true,
  "message": "Data received successfully.",
  "data": {
    "id": "66230f8d9a1b2c3d4e5f6789",
    "recordedAt": "2026-04-20T10:30:00.000Z"
  }
}
```

### Fetch the dashboard overview

```bash
curl http://localhost:8000/api/v1/dashboard/overview
```

```json
{
  "success": true,
  "data": {
    "temperature":  { "value": 24.5,  "unit": "°C",  "status": "optimal" },
    "humidity":     { "value": 62.0,  "unit": "%",   "status": "optimal" },
    "soilMoisture": { "value": 38.0,  "unit": "%",   "status": "warning" },
    "light":        { "value": 850.0, "unit": "lux", "status": "optimal" },
    "lastUpdated":  "2026-04-20T10:30:00.000Z"
  }
}
```

### Demo — trigger each status bucket

```bash
# Critical — out of range everywhere
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":42.0,"humidity":15.0,"soilMoisture":10.0,"lightLevel":100.0}'

# Warning — outside optimal but inside operational bounds
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":30.0,"humidity":45.0,"soilMoisture":35.0,"lightLevel":400.0}'

# Optimal — all nominal
curl -X POST http://localhost:8000/api/v1/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":22.0,"humidity":60.0,"soilMoisture":55.0,"lightLevel":1000.0}'

curl http://localhost:8000/api/v1/dashboard/overview
```

---

## Threshold Reference

| Sensor        | Unit | Critical Low | Warning Low | Optimal Range | Warning High | Critical High |
| ------------- | ---- | ------------ | ----------- | ------------- | ------------ | ------------- |
| Temperature   | °C   | < 10         | 10 – 18     | 18 – 28       | 28 – 40      | > 40          |
| Humidity      | %    | < 20         | 20 – 50     | 50 – 75       | 75 – 90      | > 90          |
| Soil Moisture | %    | < 20         | 20 – 40     | 40 – 70       | 70 – 90      | > 90          |
| Light         | lux  | < 200        | 200 – 500   | 500 – 2000    | 2000 – 5000  | > 5000        |

Thresholds live in `src/constants/sensorThresholds.ts` and are consumed by `sensorStatus.service.ts`. They can be moved to a DB-backed settings service later without touching controllers.

---

## Best Practices Baked In

- **Fail-fast config:** Zod-validated env; missing / malformed variables kill the process with a clear message.
- **DRY validation + docs:** the same Zod schema backs request validation and OpenAPI generation.
- **Uniform responses:** all successes go through `success(...)`, all errors through a single handler.
- **Typed errors:** `AppError` with factory helpers (`badRequest`, `notFound`, `conflict`, ...).
- **Async hygiene:** `asyncHandler` removes try/catch noise; unhandled rejections and uncaught exceptions are logged and trigger graceful shutdown.
- **Security:** Helmet, configurable CORS allowlist, global rate limiting, and a 1 MB JSON body cap.
- **Observability:** Winston with env-aware formatters; morgan HTTP logs streamed into Winston.
- **Graceful shutdown:** SIGINT/SIGTERM drain the HTTP server, close Mongo, and exit within a hard 10 s ceiling.
- **Scalable layout:** per-version API tree (`src/api/v1/...`) with controllers / services / models / validators / routes split by feature.

---

## Roadmap

- `GET /dashboard/trends` — 24h rolling data for charts
- `GET /environment/current` — detailed values with live threshold ranges
- `POST /devices/control` — actuate pump / lights / ventilation
- `GET /devices/commands` — ESP32 polls for pending commands
- `GET /alerts` — alert history
- Automated tests (Vitest + Supertest) and CI pipeline
