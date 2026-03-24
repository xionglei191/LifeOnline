#!/usr/bin/env bash
# ============================================================
# install-services.sh — 在部署服务器上安装 LifeOS systemd user services
# 首次部署时在 246 上运行：
#   cd ~/LifeOnline && ./scripts/install-services.sh
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
SERVICES_DIR="${REPO_DIR}/services"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

echo "📦 Installing LifeOS systemd user services..."

# Ensure systemd user directory exists
mkdir -p "${SYSTEMD_USER_DIR}"

# Link service files
for service_file in lifeos-server.service lifeos-web.service; do
  src="${SERVICES_DIR}/${service_file}"
  dst="${SYSTEMD_USER_DIR}/${service_file}"

  if [ ! -f "$src" ]; then
    echo "❌ Missing service file: ${src}"
    exit 1
  fi

  if [ -L "$dst" ] || [ -f "$dst" ]; then
    rm -f "$dst"
  fi

  ln -s "$src" "$dst"
  echo "   ✅ Linked ${service_file}"
done

# Reload systemd
systemctl --user daemon-reload
echo "   ✅ systemd daemon reloaded"

# Enable services (start on login)
systemctl --user enable lifeos-server.service lifeos-web.service
echo "   ✅ Services enabled (auto-start on login)"

# Enable lingering so services run without active login session
loginctl enable-linger "$(whoami)" 2>/dev/null || true
echo "   ✅ Lingering enabled (services persist after logout)"

# Start services
systemctl --user start lifeos-server.service
echo "   ✅ lifeos-server started"

sleep 2

systemctl --user start lifeos-web.service
echo "   ✅ lifeos-web started"

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Useful commands:"
echo "   systemctl --user status lifeos-server"
echo "   systemctl --user status lifeos-web"
echo "   journalctl --user -u lifeos-server -f"
echo "   journalctl --user -u lifeos-web -f"
echo "   systemctl --user restart lifeos-server lifeos-web"
