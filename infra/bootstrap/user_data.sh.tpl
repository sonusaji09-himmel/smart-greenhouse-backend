#!/bin/bash
# Smart Greenhouse EC2 bootstrap — rendered by Terraform templatefile()
set -euo pipefail
exec > /var/log/greenhouse-bootstrap.log 2>&1
echo "=== Greenhouse bootstrap started at $$(date -Is) ==="

export DEBIAN_FRONTEND=noninteractive

# ─── Base packages ───────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y git curl ca-certificates gnupg

# ─── Swap (helps t3.small during npm build + InfluxDB) ───────────────────────
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ─── Docker ──────────────────────────────────────────────────────────────────
apt-get install -y docker.io
systemctl enable docker
systemctl start docker

# ─── Node.js 20 ──────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version

# ─── InfluxDB (localhost only) ───────────────────────────────────────────────
docker rm -f influx 2>/dev/null || true
docker volume create influx-data 2>/dev/null || true

docker run -d \
  --name influx \
  --restart unless-stopped \
  -p 127.0.0.1:8086:8086 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD='${influx_password}' \
  -e DOCKER_INFLUXDB_INIT_ORG='${influx_org}' \
  -e DOCKER_INFLUXDB_INIT_BUCKET='${influx_bucket}' \
  -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN='${influx_token}' \
  -e DOCKER_INFLUXDB_INIT_RETENTION=7d \
  -v influx-data:/var/lib/influxdb2 \
  influxdb:2

echo "Waiting for InfluxDB..."
for i in $$(seq 1 60); do
  if curl -sf http://127.0.0.1:8086/health >/dev/null 2>&1; then
    echo "InfluxDB is up"
    break
  fi
  sleep 5
done

# ─── Application code ────────────────────────────────────────────────────────
rm -rf /opt/app
git clone --depth 1 -b '${git_branch}' '${git_repo}' /opt/app
cd /opt/app
npm ci
npm run build

# ─── Environment file ────────────────────────────────────────────────────────
cat > /opt/app/.env <<'ENVEOF'
NODE_ENV=production
PORT=80
API_PREFIX=/api
API_VERSION=v1

INFLUX_URL=http://127.0.0.1:8086
INFLUX_TOKEN=${influx_token}
INFLUX_ORG=${influx_org}
INFLUX_BUCKET=${influx_bucket}
INFLUX_MEASUREMENT=sensor_reading

MQTT_URL=${mqtt_url}
MQTT_CLIENT_ID=smart-greenhouse-backend
MQTT_USERNAME=${mqtt_username}
MQTT_PASSWORD=${mqtt_password}
MQTT_TOPIC_PREFIX=greenhouse
MQTT_SUBSCRIBE_TOPIC=esp32s3/smartfarm/+
MQTT_QOS=1
MQTT_RECONNECT_PERIOD_MS=5000
MQTT_CONNECT_TIMEOUT_MS=15000

ESP32_DEVICE_ID=esp32-01
ESP32_FLUSH_MS=2000

AUTH_ENABLED=${auth_enabled}
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=1d
ADMIN_EMAIL=admin@greenhouse.local
ADMIN_PASSWORD=ChangeMe123!

CORS_ORIGINS=${cors_origins}
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
ENVEOF

chmod 600 /opt/app/.env

# ─── systemd service (root binds port 80) ────────────────────────────────────
cat > /etc/systemd/system/greenhouse.service <<'UNITEOF'
[Unit]
Description=Smart Greenhouse API
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/app
EnvironmentFile=/opt/app/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable greenhouse
systemctl restart greenhouse

echo "=== Greenhouse bootstrap finished at $$(date -Is) ==="
echo "API: http://$$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo localhost)/api/v1/health"
