#!/bin/bash
# Open the locally deployed LineWatch parent desk.
set -u

URL="http://127.0.0.1:8080/"
LABEL="com.linewatch.desk"

if ! curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS --max-time 1 "$URL" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

osascript -e 'display alert "LineWatch could not start" message "Restart the Mac or open the LineWatch launcher again." as critical'
exit 1
