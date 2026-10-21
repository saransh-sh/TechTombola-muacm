#!/usr/bin/env bash
# ==============================================================================
# Tech Tombola — Automated AWS Deployment Script (EC2 & Lightsail)
# Supported OS: Amazon Linux 2023, Ubuntu 22.04/24.04, Debian 12
# ==============================================================================
set -euo pipefail

echo "========================================================"
echo "    Tech Tombola — Automated AWS EC2 Deployment        "
echo "========================================================"

# Check root or sudo privileges
SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "ERROR: This script must be run as root or with sudo." >&2
    exit 1
  fi
fi

# Detect Package Manager
echo "=> [1/6] Detecting operating system and installing Docker..."
if command -v dnf >/dev/null 2>&1; then
  # Amazon Linux 2023 / Fedora / RHEL
  $SUDO dnf update -y
  $SUDO dnf install -y docker git curl
  $SUDO systemctl enable --now docker
  # Install docker compose plugin if not present
  if ! docker compose version >/dev/null 2>&1; then
    $SUDO dnf install -y docker-compose-plugin || true
  fi
elif command -v apt-get >/dev/null 2>&1; then
  # Ubuntu / Debian
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl gnupg git
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | $SUDO sh
  fi
  $SUDO systemctl enable --now docker
fi

# Add current user to docker group if applicable
CURRENT_USER="${SUDO_USER:-$USER}"
if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "root" ]; then
  $SUDO usermod -aG docker "$CURRENT_USER" || true
fi

# Ensure docker compose is available
if ! docker compose version >/dev/null 2>&1; then
  echo "=> Installing Docker Compose standalone binary fallback..."
  DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/local/lib/docker}
  $SUDO mkdir -p $DOCKER_CONFIG/cli-plugins
  $SUDO curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o $DOCKER_CONFIG/cli-plugins/docker-compose
  $SUDO chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
fi

echo "=> Docker version: $(docker --version)"
echo "=> Docker Compose version: $(docker compose version)"

# Determine project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
echo "=> Project directory: $PROJECT_DIR"

# 2. Configure Environment Variables
echo "=> [2/6] Configuring production environment (.env)..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
  else
    touch .env
  fi

  # Generate cryptographically secure secrets
  JWT_SEC=$(openssl rand -hex 24)
  SESS_SEC=$(openssl rand -hex 24)
  BOOT_SEC=$(openssl rand -hex 24)
  PG_PASS=$(openssl rand -hex 16)

  # Fetch public IP for initial APP_URL and CORS_ORIGIN
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://checkip.amazonaws.com || curl -s --connect-timeout 2 https://ifconfig.me || echo "127.0.0.1")

  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SEC}|g" .env || echo "JWT_SECRET=${JWT_SEC}" >> .env
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESS_SEC}|g" .env || echo "SESSION_SECRET=${SESS_SEC}" >> .env
  sed -i "s|SUPER_ADMIN_BOOTSTRAP_SECRET=.*|SUPER_ADMIN_BOOTSTRAP_SECRET=${BOOT_SEC}|g" .env || echo "SUPER_ADMIN_BOOTSTRAP_SECRET=${BOOT_SEC}" >> .env
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|g" .env || echo "POSTGRES_PASSWORD=${PG_PASS}" >> .env
  sed -i "s|APP_URL=.*|APP_URL=http://${PUBLIC_IP}|g" .env || echo "APP_URL=http://${PUBLIC_IP}" >> .env
  sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://${PUBLIC_IP},http://localhost|g" .env || echo "CORS_ORIGIN=http://${PUBLIC_IP},http://localhost" >> .env

  echo "=> Generated new .env file with production secrets."
  echo "=> Server Public IP detected: http://${PUBLIC_IP}"
else
  echo "=> Existing .env detected. Keeping current configuration."
fi

# 3. Pull and Build Containers
echo "=> [3/6] Building and starting Tech Tombola Docker stack..."
$SUDO docker compose build
$SUDO docker compose up -d

# 4. Install Systemd Service for Auto-Restart on Reboot
echo "=> [4/6] Installing systemd auto-restart service..."
SERVICE_PATH="/etc/systemd/system/techtombola.service"
$SUDO tee "$SERVICE_PATH" > /dev/null <<EOF
[Unit]
Description=Tech Tombola Multi-Container Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable techtombola.service
echo "=> Systemd service techtombola.service enabled on boot."

# 5. Verify Health Check
echo "=> [5/6] Verifying service readiness..."
HEALTHY=false
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1/ready >/dev/null 2>&1 || curl -sf http://127.0.0.1:3000/ready >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 2
done

# 6. Summary and Next Steps
echo "========================================================"
if [ "$HEALTHY" = true ]; then
  echo " ✅ Tech Tombola is successfully deployed and running!"
else
  echo " ⚠️ Containers launched, but readiness probe is still pending."
  echo " Check logs with: docker compose logs -f"
fi
echo "========================================================"
echo " 🌐 Public URL: http://${PUBLIC_IP:-YOUR_EC2_IP}"
echo " 📊 Check status: docker compose ps"
echo " 📜 View logs:    docker compose logs -f"
echo " 🔐 Super Admin:  Use SUPER_ADMIN_BOOTSTRAP_SECRET from .env to initialize."
echo "========================================================"
