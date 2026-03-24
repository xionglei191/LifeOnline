#!/usr/bin/env bash
# ============================================================
# deploy.sh — 从本机(252)一键部署 LifeOnline 到服务器(246)
# 用法: ./scripts/deploy.sh [--build] [--restart]
#   --build    拉取代码后执行 pnpm install + pnpm build
#   --restart  重启 LifeOS server + web 前端
#   无参数     仅执行 git pull
# ============================================================

set -euo pipefail

# ---- 配置 ----
REMOTE_USER="xionglei"
REMOTE_HOST="192.168.31.246"
REMOTE_DIR="/home/xionglei/LifeOnline"
REMOTE_LIFEOS_DIR="${REMOTE_DIR}/LifeOS"
# linuxbrew 的 PATH，确保 pnpm / node 可用
REMOTE_PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/bin:/usr/bin:/bin"

DO_BUILD=false
DO_RESTART=false

for arg in "$@"; do
  case "$arg" in
    --build)   DO_BUILD=true ;;
    --restart) DO_RESTART=true ;;
    *)         echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

echo "🚀 Deploying LifeOnline to ${REMOTE_HOST}..."

# ---- Step 1: Git Pull ----
echo ""
echo "📥 Step 1: Pulling latest code from GitHub..."
ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && git pull origin main"
echo "✅ Code updated."

# ---- Step 2: Build (可选) ----
if [ "$DO_BUILD" = true ]; then
  echo ""
  echo "🔨 Step 2: Installing dependencies & building..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "export PATH=${REMOTE_PATH}:\$PATH && cd ${REMOTE_LIFEOS_DIR} && pnpm install && pnpm --filter server build && pnpm --filter web build"
  echo "✅ Build complete."
else
  echo ""
  echo "⏭️  Step 2: Skipped build (use --build to enable)."
fi

# ---- Step 3: Restart LifeOS Services (可选) ----
if [ "$DO_RESTART" = true ]; then
  echo ""
  echo "🔄 Step 3: Restarting LifeOS services..."

  # Check if systemd services are installed
  if ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user is-enabled lifeos-server.service 2>/dev/null"; then
    echo "   Using systemd user services..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user restart lifeos-server.service"
    echo "   ✅ lifeos-server restarted"
    sleep 2
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user restart lifeos-web.service"
    echo "   ✅ lifeos-web restarted"
    echo "   📋 Check logs: ssh ${REMOTE_HOST} 'journalctl --user -u lifeos-server -f'"
  else
    echo "   ⚠️  systemd services not installed. Using fallback (nohup)..."
    echo "   💡 Run on server: cd ~/LifeOnline && ./scripts/install-services.sh"

    # Fallback: legacy nohup approach
    echo "   🔸 Restarting backend server..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "pkill -f 'tsx.*watch.*src/index.ts' || true"
    sleep 1
    ssh -f "${REMOTE_USER}@${REMOTE_HOST}" "export PATH=${REMOTE_PATH}:\$PATH && cd ${REMOTE_LIFEOS_DIR}/packages/server && nohup pnpm dev > /tmp/lifeos-server.log 2>&1 &"
    echo "   ✅ Backend restarted. Logs: /tmp/lifeos-server.log"

    echo "   🔸 Restarting frontend (Vite)..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "pkill -f 'vite.*--host' || true; pkill -f 'node.*packages/web' || true"
    sleep 1
    ssh -f "${REMOTE_USER}@${REMOTE_HOST}" "export PATH=${REMOTE_PATH}:\$PATH && cd ${REMOTE_LIFEOS_DIR}/packages/web && nohup pnpm dev --host > /tmp/lifeos-web.log 2>&1 &"
    echo "   ✅ Frontend restarted. Logs: /tmp/lifeos-web.log"
  fi
  echo "   🌐 Frontend URL: http://${REMOTE_HOST}:5173/"
else
  echo ""
  echo "⏭️  Step 3: Skipped restart (use --restart to enable)."
fi

echo ""
echo "🎉 Deploy complete!"
echo "   Remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
echo "   Branch: main"
