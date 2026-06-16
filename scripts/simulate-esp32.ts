/**
 * ESP32 telemetry simulator for end-to-end demos.
 *
 * Publishes JSON readings to greenhouse/{deviceId}/telemetry every 3 seconds,
 * cycling scenarios that exercise automation (pump / lights / window).
 *
 * Run: npm run demo:simulate
 * Requires: HiveMQ Cloud credentials in .env (MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD)
 */
import dotenv from 'dotenv';
import mqtt from 'mqtt';

dotenv.config();

const DEVICE_ID = 'esp32-01';
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? 'greenhouse';
const MQTT_URL = process.env.MQTT_URL ?? '';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const INTERVAL_MS = 3_000;

if (!MQTT_URL || MQTT_URL.includes('your-cluster') || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error(
    '[esp32-sim] Missing HiveMQ config. Set MQTT_URL, MQTT_USERNAME, and MQTT_PASSWORD in .env',
  );
  process.exit(1);
}

type Scenario = {
  name: string;
  temperature: number;
  soilMoisture: number;
  lightLevel: number;
  waterLevel: number;
};

/** Matches sensorReadingSchema + automation thresholds in sensorThresholds.ts */
const SCENARIOS: Scenario[] = [
  {
    name: 'normal',
    temperature: 22,
    soilMoisture: 55,
    lightLevel: 60,
    waterLevel: 80,
  },
  {
    name: 'dry-soil (auto pump)',
    temperature: 24,
    soilMoisture: 22,
    lightLevel: 60,
    waterLevel: 75,
  },
  {
    name: 'dark (auto lights)',
    temperature: 21,
    soilMoisture: 55,
    lightLevel: 15,
    waterLevel: 80,
  },
  {
    name: 'hot (auto window)',
    temperature: 29,
    soilMoisture: 55,
    lightLevel: 60,
    waterLevel: 80,
  },
];

let sequence = 0;

const topic = `${TOPIC_PREFIX}/${DEVICE_ID}/telemetry`;

console.log(`[esp32-sim] Connecting to ${MQTT_URL}`);
console.log(`[esp32-sim] Publishing to ${topic} every ${INTERVAL_MS / 1000}s`);
console.log('[esp32-sim] Scenarios:', SCENARIOS.map((s) => s.name).join(' → '));
console.log('[esp32-sim] Press Ctrl+C to stop\n');

const client = mqtt.connect(MQTT_URL, {
  clientId: `esp32-sim-${DEVICE_ID}`,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clean: true,
  reconnectPeriod: 2_000,
});

client.on('error', (err) => {
  console.error('[esp32-sim] MQTT error:', err.message);
});

client.on('connect', () => {
  publishOnce();
  setInterval(publishOnce, INTERVAL_MS);
});

const publishOnce = (): void => {
  if (!client.connected) return;

  const scenario = SCENARIOS[sequence % SCENARIOS.length]!;
  sequence += 1;

  const messageId = `${DEVICE_ID}-${String(sequence).padStart(6, '0')}`;
  const payload = {
    temperature: scenario.temperature,
    soilMoisture: scenario.soilMoisture,
    lightLevel: scenario.lightLevel,
    waterLevel: scenario.waterLevel,
    deviceId: DEVICE_ID,
    messageId,
    timestamp: new Date().toISOString(),
  };

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('[esp32-sim] Publish failed:', err.message);
      return;
    }
    console.log(
      `[esp32-sim] #${sequence} [${scenario.name}] temp=${scenario.temperature}°C soil=${scenario.soilMoisture}% light=${scenario.lightLevel}%`,
    );
  });
};

process.on('SIGINT', () => {
  console.log('\n[esp32-sim] Shutting down...');
  client.end(true, () => process.exit(0));
});
