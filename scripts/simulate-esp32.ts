/**
 * ESP32 telemetry simulator for end-to-end demos.
 *
 * Mirrors the real firmware: publishes one human-readable string per sensor on
 * separate topics every few seconds, cycling scenarios that exercise the
 * dashboard status thresholds.
 *
 *   esp32s3/smartfarm/temp    → "Temperature    :24.50 °C"
 *   esp32s3/smartfarm/light   → "Light Intensity    :60% (Raw ADC: 2048);"
 *   esp32s3/smartfarm/moist1  → "Soil Moisture_1    :45% (Raw ADC: 2048);"
 *   esp32s3/smartfarm/moist2  → "Soil Moisture_2    :50% (Raw ADC: 2048);"
 *
 * Run: npm run demo:simulate
 * Requires: HiveMQ Cloud credentials in .env (MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD)
 */
import dotenv from 'dotenv';
import mqtt from 'mqtt';

dotenv.config();

const TOPIC_PREFIX = 'esp32s3/smartfarm';
const MQTT_URL = process.env.MQTT_URL ?? '';
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const INTERVAL_MS = 5_000;

if (!MQTT_URL || MQTT_URL.includes('your-cluster') || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error(
    '[esp32-sim] Missing HiveMQ config. Set MQTT_URL, MQTT_USERNAME, and MQTT_PASSWORD in .env',
  );
  process.exit(1);
}

type Scenario = {
  name: string;
  temperature: number;
  soil1: number;
  soil2: number;
  light: number;
};

/** Light/soil are percentages; temperature in °C — matches firmware output. */
const SCENARIOS: Scenario[] = [
  { name: 'normal', temperature: 22, soil1: 55, soil2: 57, light: 60 },
  { name: 'dry-soil', temperature: 24, soil1: 22, soil2: 26, light: 60 },
  { name: 'dark', temperature: 21, soil1: 55, soil2: 53, light: 15 },
  { name: 'hot', temperature: 29, soil1: 55, soil2: 57, light: 60 },
];

let sequence = 0;

console.log(`[esp32-sim] Connecting to ${MQTT_URL}`);
console.log(`[esp32-sim] Publishing to ${TOPIC_PREFIX}/{temp,light,moist1,moist2} every ${INTERVAL_MS / 1000}s`);
console.log('[esp32-sim] Scenarios:', SCENARIOS.map((s) => s.name).join(' → '));
console.log('[esp32-sim] Press Ctrl+C to stop\n');

const client = mqtt.connect(MQTT_URL, {
  // Unique per-process id so two simulators (or a real device) don't collide.
  clientId: `esp32-sim-${process.pid.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
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

const rawAdc = (pct: number): number => Math.round((pct / 100) * 4095);

const publishOnce = (): void => {
  if (!client.connected) return;

  const scenario = SCENARIOS[sequence % SCENARIOS.length]!;
  sequence += 1;

  const messages: Array<[string, string]> = [
    [`${TOPIC_PREFIX}/temp`, `Temperature    :${scenario.temperature.toFixed(2)} °C`],
    [
      `${TOPIC_PREFIX}/light`,
      `Light Intensity    :${scenario.light}% (Raw ADC: ${rawAdc(scenario.light)});`,
    ],
    [
      `${TOPIC_PREFIX}/moist1`,
      `Soil Moisture_1    :${scenario.soil1}% (Raw ADC: ${rawAdc(scenario.soil1)});`,
    ],
    [
      `${TOPIC_PREFIX}/moist2`,
      `Soil Moisture_2    :${scenario.soil2}% (Raw ADC: ${rawAdc(scenario.soil2)});`,
    ],
  ];

  for (const [topic, message] of messages) {
    client.publish(topic, message, { qos: 1 });
  }

  console.log(
    `[esp32-sim] #${sequence} [${scenario.name}] temp=${scenario.temperature}°C soil=${scenario.soil1}/${scenario.soil2}% light=${scenario.light}%`,
  );
};

process.on('SIGINT', () => {
  console.log('\n[esp32-sim] Shutting down...');
  client.end(true, () => process.exit(0));
});
