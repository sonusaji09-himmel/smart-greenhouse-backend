/**
 * ESP32 telemetry simulator for end-to-end demos.
 *
 * Publishes JSON readings to greenhouse/{deviceId}/telemetry every 3 seconds,
 * cycling scenarios that exercise automation (pump / lights / window).
 *
 * Run: npm run demo:simulate
 * Requires: Mosquitto on MQTT_URL (default mqtt://localhost:1883)
 */
import mqtt from 'mqtt';

const DEVICE_ID = 'esp32-01';
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? 'greenhouse';
const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const INTERVAL_MS = 3_000;

type Scenario = {
  name: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  lightLevel: number;
  waterLevel: number;
};

/** Matches sensorReadingSchema + automation thresholds in sensorThresholds.ts */
const SCENARIOS: Scenario[] = [
  {
    name: 'normal',
    temperature: 22,
    humidity: 62,
    soilMoisture: 55,
    lightLevel: 2500,
    waterLevel: 80,
  },
  {
    name: 'dry-soil (auto pump)',
    temperature: 24,
    humidity: 58,
    soilMoisture: 22,
    lightLevel: 2500,
    waterLevel: 75,
  },
  {
    name: 'dark (auto lights)',
    temperature: 21,
    humidity: 60,
    soilMoisture: 55,
    lightLevel: 450,
    waterLevel: 80,
  },
  {
    name: 'hot-humid (auto window)',
    temperature: 29,
    humidity: 85,
    soilMoisture: 55,
    lightLevel: 2500,
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
    humidity: scenario.humidity,
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
      `[esp32-sim] #${sequence} [${scenario.name}] temp=${scenario.temperature}°C humidity=${scenario.humidity}% soil=${scenario.soilMoisture}% light=${scenario.lightLevel} lux`,
    );
  });
};

process.on('SIGINT', () => {
  console.log('\n[esp32-sim] Shutting down...');
  client.end(true, () => process.exit(0));
});
