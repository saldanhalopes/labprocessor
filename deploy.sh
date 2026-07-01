#!/bin/bash
# ================================================================
# LabProcessor Plus — Deploy Script
# ================================================================
# Usage:
#   ./deploy.sh <user> <host> [app_port] [db_port]
#
# Examples:
#   ./deploy.sh rafael 192.168.15.59
#   ./deploy.sh rafael 192.168.15.59 8082 5433
#   ./deploy.sh root lab.example.com 80 5432
#
# Requirements on local machine: tar, scp, ssh
# Requirements on remote: docker, docker compose
# ================================================================

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────
REMOTE_USER="${1:?Usage: ./deploy.sh <user> <host> [app_port] [db_port]}"
REMOTE_HOST="${2:?Host required}"
APP_PORT="${3:-8082}"
DB_PORT="${4:-5433}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="labprocessor_plus"
REMOTE_HOME="/home/${REMOTE_USER}"
REMOTE_DIR="${REMOTE_HOME}/${PROJECT_NAME}"
TARBALL="${PROJECT_NAME}.tar.gz"
DATE_TAG=$(date +%Y%m%d-%H%M%S)

echo "========================================"
echo " LabProcessor Plus — Deploy"
echo "========================================"
echo " Target: ${REMOTE_USER}@${REMOTE_HOST}"
echo " App port: ${APP_PORT}"
echo " DB port: ${DB_PORT}"
echo ""

# ── Step 1: Package project ────────────────────────────────────
echo "[1/5] Packaging project..."
cd "${PROJECT_DIR}"
tar -czf "/tmp/${TARBALL}" \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='frontend/dist' \
    --exclude='.git' \
    --exclude='*.tar.gz' \
    --exclude='tmp' \
    .

echo "  Package: /tmp/${TARBALL} ($(du -h /tmp/${TARBALL} | cut -f1))"

# ── Step 2: Upload to remote ───────────────────────────────────
echo "[2/5] Uploading to ${REMOTE_USER}@${REMOTE_HOST}..."
scp "/tmp/${TARBALL}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_HOME}/${TARBALL}"
echo "  Upload complete."

# ── Step 3: Extract on remote ──────────────────────────────────
echo "[3/5] Extracting on remote..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
set -e
mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}"
tar -xzf "${REMOTE_HOME}/${TARBALL}"
rm -f "${REMOTE_HOME}/${TARBALL}"

# Create .env with deployment ports if not exists
if [ ! -f .env ]; then
cat > .env << EOF
APP_PORT=${APP_PORT}
DB_PORT=${DB_PORT}
DB_USER=labprocessor
DB_PASSWORD=labprocessor
DB_NAME=labprocessor
JWT_SECRET=change-me-in-production
EOF
echo "  .env created with APP_PORT=${APP_PORT} DB_PORT=${DB_PORT}"
fi
ENDSSH

# ── Step 4: Build and deploy ───────────────────────────────────
echo "[4/5] Building and deploying..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" << ENDSSH
set -e
cd "${REMOTE_DIR}"

# Stop existing containers
docker compose down 2>/dev/null || true

# Build image (no cache for clean rebuild)
echo "  Building Docker image..."
docker compose build app --no-cache

# Start services
echo "  Starting containers..."
docker compose up -d

# Wait for healthy
echo "  Waiting for services..."
sleep 5

# Show status
echo ""
echo "  Container status:"
docker compose ps
ENDSSH

# ── Step 5: Verify ─────────────────────────────────────────────
echo "[5/5] Verifying deployment..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${REMOTE_HOST}:${APP_PORT}/api/config/skill/basefluxo" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ API responding (HTTP ${HTTP_CODE})"
else
    echo "  ⚠ API check returned HTTP ${HTTP_CODE} — may need a moment to start"
fi

# ── Cleanup ────────────────────────────────────────────────────
rm -f "/tmp/${TARBALL}"

echo ""
echo "========================================"
echo " Deploy complete."
echo " App: http://${REMOTE_HOST}:${APP_PORT}"
echo "========================================"
