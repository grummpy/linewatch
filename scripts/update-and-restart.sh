#!/bin/bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$HOME/Library/Application Support/Linewatch"
STATUS_FILE="$STATE_DIR/update-status.json"
LOCK_DIR="$STATE_DIR/update.lock"
LOG_FILE="$HOME/Library/Logs/Linewatch-update.log"
SERVER_PID="${LINEWATCH_SERVER_PID:-}"

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"

write_status() {
  UPDATE_STATE="$1" UPDATE_MESSAGE="$2" UPDATE_VERSION="${3:-}" \
    /usr/local/bin/node -e '
      const fs = require("node:fs");
      const path = process.argv[1];
      const body = {
        state: process.env.UPDATE_STATE,
        message: process.env.UPDATE_MESSAGE,
        version: process.env.UPDATE_VERSION || null,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path + ".tmp", JSON.stringify(body));
      fs.renameSync(path + ".tmp", path);
    ' "$STATUS_FILE"
}

cleanup() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
failed() {
  code=$?
  write_status "failed" "Update failed. Open $LOG_FILE for details."
  cleanup
  exit "$code"
}
trap failed ERR
trap cleanup EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  write_status "busy" "An update is already running."
  exit 0
fi

exec >>"$LOG_FILE" 2>&1
echo "[$(date -u +%FT%TZ)] LineWatch update started"
cd "$ROOT"

if ! git diff --quiet || ! git diff --cached --quiet; then
  write_status "failed" "Update stopped because tracked local changes need review."
  exit 1
fi

write_status "running" "Checking GitHub for updates…"
git fetch origin main
git merge --ff-only origin/main

write_status "running" "Installing dependencies…"
/usr/local/bin/npm ci --no-audit --no-fund

write_status "running" "Building LineWatch…"
/usr/local/bin/npm run build

version=$(/usr/local/bin/node -p "require('./package.json').version")
write_status "succeeded" "Update installed. LineWatch is restarting…" "$version"
echo "[$(date -u +%FT%TZ)] LineWatch update completed at v$version"

if [[ "$SERVER_PID" =~ ^[0-9]+$ ]]; then
  kill -TERM "$SERVER_PID" 2>/dev/null || true
else
  /bin/launchctl kickstart -k "gui/$(id -u)/com.linewatch.desk" >/dev/null 2>&1 || true
fi
