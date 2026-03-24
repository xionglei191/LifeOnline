#!/usr/bin/env bash
# ============================================================
# deploy.sh — 从本机(252)一键部署 LifeOnline 到服务器(246)
# 用法: ./scripts/deploy.sh [--build] [--restart] [--rollback]
#   --build    拉取代码后执行 pnpm install + pnpm build
#   --restart  重启 LifeOS server + web 前端
#   --rollback 回滚远程 main 分支到上一个版本 (HEAD~1)
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
DO_ROLLBACK=false

for arg in "$@"; do
  case "$arg" in
    --build)    DO_BUILD=true ;;
    --restart)  DO_RESTART=true ;;
    --rollback) DO_ROLLBACK=true ;;
    *)          echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# 如果既没有 rollback 也没有只是纯 pull，且我们在本机，执行本地前置类型检查
if [ "$DO_ROLLBACK" = false ]; then
  echo "🔍 前置检查: 本地 TypeScript 编译验证..."
  # 获取脚本所在目录的上上级（LifeOS目录）
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
  LIFEOS_DIR="$(dirname "$SCRIPT_DIR")/LifeOS"
  
  if [ -d "$LIFEOS_DIR" ]; then
    (cd "$LIFEOS_DIR" && npx tsc --noEmit -p packages/server/tsconfig.json) || {
      echo "❌ 失败: 本地服务端代码编译未通过！请修复后再部署。"
      exit 1
    }
    echo "✅ 编译检查通过。"
  else
    echo "⚠️ 未找到本地 LifeOS 目录，跳过编译检查。"
  fi
fi

echo "🚀 Deploying LifeOnline to ${REMOTE_HOST}..."

# ---- Step 1: Git Pull / Rollback ----
echo ""
if [ "$DO_ROLLBACK" = true ]; then
  echo "⏪ Step 1: Rolling back remote repository to HEAD~1..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && git reset --hard HEAD~1"
  echo "✅ Remote repository rolled back."
  # 强制要求 rollback 时重新 build
  DO_BUILD=true
else
  echo "📥 Step 1: Pulling latest code from GitHub..."
  ssh "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && git pull origin main"
  echo "✅ Code updated."
fi

# ---- Step 2: Build (可选或强制) ----
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

  # 强制要求使用 systemd services
  if ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user is-enabled lifeos-server.service 2>/dev/null"; then
    echo "   Using systemd user services..."
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user restart lifeos-server.service"
    echo "   ✅ lifeos-server restarted"
    sleep 2
    ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl --user restart lifeos-web.service"
    echo "   ✅ lifeos-web restarted"
    echo "   📋 Check logs: ssh ${REMOTE_HOST} 'journalctl --user -u lifeos-server -f'"
  else
    echo "   ❌ 错误: 远程服务器未安装 systemd services。"
    echo "   💡 请先在服务器上运行: cd ~/LifeOnline && ./scripts/install-services.sh"
    exit 1
  fi
  echo "   🌐 Frontend URL: http://${REMOTE_HOST}:5173/"
else
  echo ""
  echo "⏭️  Step 3: Skipped restart (use --restart to enable)."
fi

echo ""
echo "🎉 Deploy complete!"
echo "   Remote: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
if [ "$DO_ROLLBACK" = true ]; then
  echo "   Status: Rolled back to HEAD~1"
else
  echo "   Branch: main"
fi
