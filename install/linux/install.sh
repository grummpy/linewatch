#!/bin/sh
# Linewatch — Chris Decker
# Makes this computer house DNS and installs the always-on service when root.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js, then run this again."
  exit 1
fi
if [ "$(id -u)" -eq 0 ]; then
  mkdir -p /opt/linewatch /var/lib/linewatch
  cp -R "$ROOT"/. /opt/linewatch
  cp collector/linewatch.service /etc/systemd/system/linewatch.service
  systemctl daemon-reload
  systemctl enable --now linewatch
  echo "Always-on service started."
  node install/setup.mjs --desk-only
else
  echo "Run this installer with sudo for one-button always-on DNS."
  echo "Starting a temporary foreground session instead."
  exec node install/setup.mjs
fi
