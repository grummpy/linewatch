#!/bin/bash
# Linewatch — Chris Decker
# Double-click in Finder. This Mac becomes house DNS.
cd "$(dirname "$0")/../.."
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org then double-click again."
  read -r _
  exit 1
fi
exec node install/setup.mjs
