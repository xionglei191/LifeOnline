#!/usr/bin/env bash
# setup-cron.sh — 设置每日凌晨 3:00 自动备份 SQLite
#
# Usage:  bash scripts/setup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.ts"
TSX_BIN="$(which tsx 2>/dev/null || echo '/home/linuxbrew/.linuxbrew/bin/tsx')"
ENV_FILE="$PROJECT_ROOT/LifeOS/packages/server/.env.production"

CRON_COMMENT="# LifeOS daily SQLite backup"
CRON_JOB="0 3 * * * . $ENV_FILE && $TSX_BIN $BACKUP_SCRIPT >> /tmp/lifeos-backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "lifeos-backup\|backup.ts"; then
  echo "⚠️  Cron job already exists. Skipping."
  crontab -l | grep -i backup
  exit 0
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMENT"; echo "$CRON_JOB") | crontab -

echo "✅ Cron job installed:"
echo "   Schedule: 每天 03:00"
echo "   Script:   $BACKUP_SCRIPT"
echo "   Log:      /tmp/lifeos-backup.log"
echo ""
echo "验证: crontab -l"
