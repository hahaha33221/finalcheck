#!/usr/bin/env bash
# Deploys/updates the finalcheck bus board on a fresh (or existing) Ubuntu/Debian VPS.
# Run as root (or via sudo). Re-running it later just pulls the latest code and restarts
# the service, so it's safe to use for updates too.
#
# Usage:
#   REPO_BRANCH=claude/2pm-first-come-ride-check-pq8qnw ./deploy.sh
#
# First run only: it will ask for the admin password interactively if
# /opt/finalcheck/server/.env does not exist yet.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/hahaha33221/finalcheck.git}"
REPO_BRANCH="${REPO_BRANCH:-claude/2pm-first-come-ride-check-pq8qnw}"
APP_DIR="/opt/finalcheck"
SERVICE_USER="finalcheck"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (or with sudo)." >&2
  exit 1
fi

echo "==> Installing prerequisites (git, curl, build tools, nginx)"
apt-get update -y
apt-get install -y git curl build-essential nginx ca-certificates

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "==> Installing Node.js 20.x LTS"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node version: $(node -v)"

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "==> Creating service user '$SERVICE_USER'"
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

if [ -d "$APP_DIR/.git" ]; then
  echo "==> Updating existing checkout"
  cd "$APP_DIR"
  git fetch origin "$REPO_BRANCH"
  git checkout "$REPO_BRANCH"
  git reset --hard "origin/$REPO_BRANCH"
else
  echo "==> Cloning repository"
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> Installing server dependencies"
cd "$APP_DIR/server"
npm ci --omit=dev

if [ ! -f "$APP_DIR/server/.env" ]; then
  echo "==> First-time setup: creating server/.env"
  read -rsp "Set the admin login password for the board: " ADMIN_PW
  echo
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  read -rp "Public URL the frontend will be served from (e.g. https://board.example.com), leave blank for http://SERVER_IP: " PUBLIC_URL
  cat > "$APP_DIR/server/.env" <<EOF
PORT=4000
ADMIN_PASSWORD=${ADMIN_PW}
SESSION_SECRET=${SESSION_SECRET}
CORS_ORIGIN=${PUBLIC_URL}
NODE_ENV=production
EOF
  chmod 600 "$APP_DIR/server/.env"
  echo "Wrote $APP_DIR/server/.env -- the admin password is hashed into server/data/admin.json on first boot;"
  echo "you may remove ADMIN_PASSWORD from .env after the service has started once."
fi

echo "==> Building frontend"
cd "$APP_DIR/client"
npm ci
npm run build

echo "==> Fixing ownership"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

echo "==> Installing systemd service"
cp "$APP_DIR/deploy/finalcheck-api.service" /etc/systemd/system/finalcheck-api.service
systemctl daemon-reload
systemctl enable finalcheck-api
systemctl restart finalcheck-api

if [ ! -f /etc/nginx/sites-enabled/finalcheck ]; then
  echo "==> Installing nginx site (edit /etc/nginx/sites-available/finalcheck to set server_name, then run certbot)"
  cp "$APP_DIR/deploy/nginx.conf.example" /etc/nginx/sites-available/finalcheck
  ln -sf /etc/nginx/sites-available/finalcheck /etc/nginx/sites-enabled/finalcheck
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t
systemctl reload nginx

echo "==> Done."
echo "API status: systemctl status finalcheck-api"
echo "Logs:       journalctl -u finalcheck-api -f"
echo "Visit the server's IP or your domain over HTTP now; set up HTTPS with:"
echo "  apt-get install -y certbot python3-certbot-nginx"
echo "  certbot --nginx -d your-domain.example"
