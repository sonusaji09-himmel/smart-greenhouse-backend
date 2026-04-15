# Smart Greenhouse — Backend API

A backend system that receives sensor data from an ESP32, stores it in MongoDB, and serves it to a React dashboard over HTTP.

---

## How It Works

```
ESP32 (sensors)  →  POST /api/sensors/data  →  Backend  →  MongoDB
React Dashboard  ←  GET  /api/dashboard/overview  ←  Backend  ←  MongoDB
```

- The ESP32 sends temperature, humidity, soil moisture, and light readings every ~30 seconds
- The backend stores them in MongoDB and computes a status (optimal / warning / critical)
- The React frontend polls the dashboard endpoint to display live data

---

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Backend  | ASP.NET Core 8 Web API  |
| Database | MongoDB                 |
| Device   | ESP32 (HTTP POST)       |
| Frontend | React (separate repo)   |

---

## Setup Guide

Follow the steps below for your operating system. Do them in order.

---

## Mac — Full Setup from Zero

### Step 1 — Install Homebrew (if not already installed)

Open **Terminal** and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Skip this step if you already have Homebrew (`brew --version` to check).

---

### Step 2 — Install .NET 8 SDK

```bash
brew install --cask dotnet-sdk
```

Verify the installation:
```bash
dotnet --version
```
You should see `8.x.x`. If you do, .NET is ready.

---

### Step 3 — Install MongoDB

```bash
brew tap mongodb/brew
brew install mongodb-community
```

---

### Step 4 — Start MongoDB

```bash
brew services start mongodb-community
```

Verify MongoDB is running:
```bash
brew services list
```
You should see `mongodb-community` with status `started`.

---

### Step 5 — Run the Backend

Navigate to the project folder and start the server:
```bash
cd /path/to/smart-greenhouse/SmartGreenhouse.API
dotnet restore
dotnet run
```

> Replace `/path/to/smart-greenhouse` with the actual folder location on your machine.

You should see output like:
```
info: Now listening on: http://localhost:5000
```

The API is now running at `http://localhost:5000`.

---

### Step 6 — Test It (Mac)

Open a **new Terminal tab** and run:

**Send a sensor reading (simulates the ESP32):**
```bash
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 24.5,
    "humidity": 62.0,
    "soilMoisture": 38.0,
    "lightLevel": 850.0
  }'
```

Expected response:
```json
{ "message": "Data received successfully." }
```

**Get the dashboard (simulates React):**
```bash
curl http://localhost:5000/api/dashboard/overview
```

Expected response:
```json
{
  "temperature":  { "value": 24.5,  "unit": "°C",  "status": "optimal" },
  "humidity":     { "value": 62.0,  "unit": "%",   "status": "optimal" },
  "soilMoisture": { "value": 38.0,  "unit": "%",   "status": "warning" },
  "light":        { "value": 850.0, "unit": "lux", "status": "optimal" },
  "lastUpdated":  "2026-04-15T10:30:00Z"
}
```

---

## Windows — Full Setup from Zero

### Step 1 — Install .NET 8 SDK

1. Go to: https://dotnet.microsoft.com/en-us/download/dotnet/8.0
2. Under **.NET 8.0**, click **Download .NET SDK x64** (Windows Installer)
3. Run the downloaded `.exe` file and follow the installer
4. When done, open **Command Prompt** and verify:

```cmd
dotnet --version
```
You should see `8.x.x`. If you do, .NET is ready.

---

### Step 2 — Install MongoDB

1. Go to: https://www.mongodb.com/try/download/community
2. Select **Version: 7.x**, **Platform: Windows**, **Package: MSI**
3. Click **Download** and run the installer
4. During install, keep **"Install MongoDB as a Service"** checked — this means MongoDB starts automatically with Windows

Verify MongoDB is installed:
```cmd
mongod --version
```

---

### Step 3 — Start MongoDB

If MongoDB was installed as a service (default), it is already running.

To start it manually (open **Command Prompt as Administrator**):
```cmd
net start MongoDB
```

To verify it is running:
```cmd
sc query MongoDB
```
Look for `STATE: RUNNING`.

---

### Step 4 — Run the Backend

Open **Command Prompt** or **PowerShell** and run:
```cmd
cd C:\path\to\smart-greenhouse\SmartGreenhouse.API
dotnet restore
dotnet run
```

> Replace `C:\path\to\smart-greenhouse` with the actual folder location on your machine.

You should see:
```
info: Now listening on: http://localhost:5000
```

The API is now running at `http://localhost:5000`.

---

### Step 5 — Test It (Windows)

Open a **new PowerShell window** and run:

**Send a sensor reading (simulates the ESP32):**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/sensors/data" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "temperature": 24.5,
    "humidity": 62.0,
    "soilMoisture": 38.0,
    "lightLevel": 850.0
  }'
```

Expected response:
```
message
-------
Data received successfully.
```

**Get the dashboard (simulates React):**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/dashboard/overview" -Method GET
```

---

## Demo — Show All Three Statuses to Your Team

Run these back-to-back to show critical → warning → optimal in action.

### Mac / Linux
```bash
# 1. Critical — everything out of range
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":42.0,"humidity":15.0,"soilMoisture":10.0,"lightLevel":100.0}'
curl http://localhost:5000/api/dashboard/overview

# 2. Warning — values outside optimal but not dangerous
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":30.0,"humidity":45.0,"soilMoisture":35.0,"lightLevel":400.0}'
curl http://localhost:5000/api/dashboard/overview

# 3. Optimal — everything in range
curl -X POST http://localhost:5000/api/sensors/data \
  -H "Content-Type: application/json" \
  -d '{"temperature":22.0,"humidity":60.0,"soilMoisture":55.0,"lightLevel":1000.0}'
curl http://localhost:5000/api/dashboard/overview
```

### Windows (PowerShell)
```powershell
# 1. Critical
Invoke-RestMethod -Uri "http://localhost:5000/api/sensors/data" -Method POST -ContentType "application/json" -Body '{"temperature":42.0,"humidity":15.0,"soilMoisture":10.0,"lightLevel":100.0}'
Invoke-RestMethod -Uri "http://localhost:5000/api/dashboard/overview"

# 2. Warning
Invoke-RestMethod -Uri "http://localhost:5000/api/sensors/data" -Method POST -ContentType "application/json" -Body '{"temperature":30.0,"humidity":45.0,"soilMoisture":35.0,"lightLevel":400.0}'
Invoke-RestMethod -Uri "http://localhost:5000/api/dashboard/overview"

# 3. Optimal
Invoke-RestMethod -Uri "http://localhost:5000/api/sensors/data" -Method POST -ContentType "application/json" -Body '{"temperature":22.0,"humidity":60.0,"soilMoisture":55.0,"lightLevel":1000.0}'
Invoke-RestMethod -Uri "http://localhost:5000/api/dashboard/overview"
```

---

## Threshold Reference

| Sensor        | Unit | Critical Low | Warning Low | Optimal Range | Warning High | Critical High |
|---------------|------|-------------|-------------|---------------|-------------|---------------|
| Temperature   | °C   | < 10        | 10 – 18     | 18 – 28       | 28 – 40     | > 40          |
| Humidity      | %    | < 20        | 20 – 50     | 50 – 75       | 75 – 90     | > 90          |
| Soil Moisture | %    | < 20        | 20 – 40     | 40 – 70       | 70 – 90     | > 90          |
| Light         | lux  | < 200       | 200 – 500   | 500 – 2000    | 2000 – 5000 | > 5000        |

---

## API Endpoints

| Method | Endpoint                  | Called By | Description                    |
|--------|---------------------------|-----------|--------------------------------|
| POST   | `/api/sensors/data`       | ESP32     | Submit a sensor reading        |
| GET    | `/api/dashboard/overview` | React     | Get latest reading with status |

---

## Configuration

MongoDB connection is configured in `appsettings.json`:

```json
{
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "smart_greenhouse"
  }
}
```

Change `ConnectionString` if MongoDB is running on a different machine or port.

---

## Project Structure

```
SmartGreenhouse.API/
├── Controllers/
│   ├── SensorController.cs       ← POST /api/sensors/data
│   └── DashboardController.cs    ← GET  /api/dashboard/overview
├── Models/
│   └── SensorReading.cs          ← MongoDB document shape
├── DTOs/
│   ├── SensorReadingInputDto.cs  ← What ESP32 sends
│   └── DashboardOverviewDto.cs   ← What React receives
├── Services/
│   ├── SensorService.cs          ← Save + retrieve readings
│   └── SensorStatusEvaluator.cs  ← optimal / warning / critical logic
├── Data/
│   ├── MongoDbContext.cs          ← MongoDB connection + collections
│   └── MongoDbSettings.cs        ← Config model
├── Program.cs                    ← App setup, DI, CORS
└── appsettings.json              ← MongoDB connection string
```

---

## What's Next (Not Yet Built)

- `GET /api/dashboard/trends` — 24h trend data for charts
- `GET /api/environment/current` — detailed values with threshold ranges
- `POST /api/devices/control` — turn pump / lights / ventilation on or off
- `GET /api/devices/commands` — ESP32 polls for pending commands
- `GET /api/alerts` — list of triggered alerts
