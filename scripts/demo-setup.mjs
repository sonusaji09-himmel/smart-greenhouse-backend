#!/usr/bin/env node
/**
 * Cross-platform demo bootstrap: copies .env.demo → .env if missing.
 * Works on Windows (cmd/PowerShell), macOS, and Linux — no shell cp/copy.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envDemo = resolve(root, '.env.demo');
const envFile = resolve(root, '.env');

if (!existsSync(envDemo)) {
  console.error('Missing .env.demo — run this from the project root.');
  process.exit(1);
}

if (!existsSync(envFile)) {
  copyFileSync(envDemo, envFile);
  console.log('[demo:setup] Created .env from .env.demo');
} else {
  console.log('[demo:setup] .env already exists — skipped copy (delete .env to reset)');
}

console.log('');
console.log('Next steps:');
console.log('  1. Start Docker Desktop (Windows) or ensure Docker is running');
console.log('  2. npm run demo:start     # infra + backend + ESP32 simulator');
console.log('  3. Open DEMO.md for verify queries and actuator POST examples');
console.log('');
