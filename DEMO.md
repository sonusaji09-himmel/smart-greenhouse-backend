# Smart Greenhouse — End-to-End Demo

Reproducible demo of the full pipeline:

**ESP32 simulator → MQTT (HiveMQ Cloud) → Node.js backend → InfluxDB → REST API (actuator POST)**

Works on **Windows** (cmd / PowerShell), **macOS**, and **Linux**. No WSL or Git Bash required.

---

## Prerequisites

| Tool | Windows | macOS / Linux |
|------|---------|---------------|
| [Docker Desktop](https://docs.docker.com/desktop/) | Required (InfluxDB only) | Docker Engine or Desktop |
| [Node.js 20+](https://nodejs.org) | Required | Required |
| [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud/) cluster | Required (free tier works) | Required |

Ensure Docker is **running** before `npm run demo:start`. Set `MQTT_URL`, `MQTT_USERNAME`, and `MQTT_PASSWORD` in `.env` (copied from `.env.demo` via `npm run demo:setup`).

---

## Quick start (3 steps)

Open **cmd**, **PowerShell**, or a terminal in the project folder:

```bash
npm install
npm run demo:setup
# Edit .env — set your HiveMQ Cloud URL and credentials
npm run demo:start
```

- **Terminal 1** runs: Docker (InfluxDB) → waits for InfluxDB → backend + ESP32 simulator together.
- Leave it running; open a **second terminal** for actuator commands below.

Stop everything: `Ctrl+C` in the demo terminal, then:

```bash
npm run demo:stop
```

---

## What runs where

| Component | How | Port / endpoint |
|-----------|-----|-----------------|
| HiveMQ Cloud MQTT | External broker (TLS) | `mqtts://…:8883` |
| InfluxDB | `docker compose` | 8086 |
| Node.js API | `npm run dev` | 8000 |
| ESP32 simulator | `scripts/simulate-esp32.ts` | publishes to HiveMQ Cloud |

Simulator cycles every **3 seconds**:

1. **normal** — baseline readings  
2. **dry-soil** — triggers auto pump (soil &lt; 50%)  
3. **dark** — triggers auto lights (light &lt; 30%)  
4. **hot** — triggers auto window (temp &gt; 27°C)

---

## Verify the pipeline

### 1. API health

**curl (Windows 10+, macOS, Linux):**

```bash
curl "http://localhost:8000/api/v1/health"
```

**PowerShell:**

```powershell
Invoke-RestMethod "http://localhost:8000/api/v1/health"
```

Expect `influxdb: "connected"` and `mqtt: "connected"` after ~30 seconds.

### 2. Latest sensor reading

```bash
curl "http://localhost:8000/api/v1/sensors/latest?deviceId=esp32-01"
```

### 3. InfluxDB UI

1. Open [http://localhost:8086](http://localhost:8086)  
2. Login: **admin** / **greenhouse123**  
3. **Data Explorer** → paste:

```flux
from(bucket: "greenhouse")
  |> range(start: -15m)
  |> filter(fn: (r) => r._measurement == "sensor_reading")
  |> filter(fn: (r) => r.deviceId == "esp32-01")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
```

You should see `temperature`, `soilMoisture`, `lightLevel` updating every few seconds.

### 4. Swagger UI

[http://localhost:8000/api-docs](http://localhost:8000/api-docs)

---

## Actuator actions (POST)

`AUTH_ENABLED=false` in demo `.env` — no JWT required.

Manual commands are validated against the **latest sensor reading**. Use the matching scenario timing, or call right after the simulator prints that scenario.

| Actuator | Manual POST works when… |
|----------|-------------------------|
| **pump** `activate` | soil moisture **&lt; 50%** (dry-soil scenario) |
| **lights** `activate` | light **&lt; 30%** (dark scenario) |
| **window** `activate` | temp **&gt; 27°C** (hot scenario) |

### curl (quote URLs on Windows cmd)

```bash
curl -X POST "http://localhost:8000/api/v1/actuators/pump/activate?deviceId=esp32-01"
curl -X POST "http://localhost:8000/api/v1/actuators/lights/activate?deviceId=esp32-01"
curl -X POST "http://localhost:8000/api/v1/actuators/window/activate?deviceId=esp32-01"
curl -X POST "http://localhost:8000/api/v1/actuators/pump/deactivate?deviceId=esp32-01"
```

### PowerShell

```powershell
Invoke-WebRequest -Method POST "http://localhost:8000/api/v1/actuators/pump/activate?deviceId=esp32-01"
Invoke-WebRequest -Method POST "http://localhost:8000/api/v1/actuators/lights/activate?deviceId=esp32-01"
Invoke-WebRequest -Method POST "http://localhost:8000/api/v1/actuators/window/activate?deviceId=esp32-01"
```

Successful response includes `"success": true` and publishes to MQTT topic `greenhouse/esp32-01/commands`.

### Actuator state

```bash
curl "http://localhost:8000/api/v1/actuators/state"
```

---

## npm scripts reference

| Script | Description |
|--------|-------------|
| `npm run demo:setup` | Copy `.env.demo` → `.env` (once) |
| `npm run demo:infra` | Start Docker (InfluxDB); wait for health |
| `npm run demo:simulate` | ESP32 MQTT publisher only |
| `npm run demo:start` | Infra + backend + simulator (full demo) |
| `npm run demo:stop` | `docker compose down` |

### Run pieces separately (two terminals)

**Terminal 1:**

```bash
npm run demo:infra
npm run dev
```

**Terminal 2:**

```bash
npm run demo:simulate
```

---

## Troubleshooting (Windows)

| Issue | Fix |
|-------|-----|
| `docker` not recognized | Install/start **Docker Desktop**; restart terminal |
| Port 8086 / 8000 in use | Stop other services or change ports in `docker-compose.yml` / `.env` |
| InfluxDB token errors | Run `npm run demo:stop`, delete volumes if needed: `docker compose down -v`, then `npm run demo:start` |
| `curl` fails on cmd | Use double quotes around URLs; or use PowerShell `Invoke-WebRequest` |
| Pump POST returns 409 | Wait for **dry-soil** scenario in simulator logs, then retry |
| MQTT disconnected in health | Check `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` in `.env`; verify HiveMQ Cloud cluster is running and internet is available |

---

## Reset demo environment

```bash
npm run demo:stop
docker compose down -v
npm run demo:setup
npm run demo:start
```

`-v` removes InfluxDB volumes so the fixed demo token in `.env.demo` matches a fresh init.

---

## Security note

Demo uses a **fixed** InfluxDB token on localhost and connects to **HiveMQ Cloud** with credentials in `.env`. Do not commit real HiveMQ passwords. Use only for team demos — not in production without `AUTH_ENABLED=true` and strong secrets.
