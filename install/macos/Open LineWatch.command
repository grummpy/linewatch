#!/bin/bash
# Open the locally deployed LineWatch parent desk.
set -u

URL="http://127.0.0.1:8080/"
CHECK="${URL}api/system/update-check"
UPDATE="${URL}api/system/update"
STATUS="${URL}api/system/update-status"
LABEL="com.linewatch.desk"
LOG="$HOME/Library/Logs/LineWatch-launcher.log"

field() {
  key="$1"
  /usr/local/bin/node -e 'let s=""; process.stdin.on("data", d => s += d).on("end", () => { try { const v = JSON.parse(s)[process.argv[1]]; console.log(v === undefined || v === null ? "" : String(v)); } catch (_) { console.log(""); } })' "$key"
}

note() {
  /usr/bin/printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$LOG"
}

if ! curl -fsS --max-time 1 "$URL" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -fsS --max-time 1 "$URL" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if curl -fsS --max-time 2 "$URL" >/dev/null 2>&1; then
  note "LineWatch is healthy; checking the published GitHub version."
  CHECK_RESULT=$(/usr/bin/curl -fsS --max-time 25 "$CHECK" 2>/dev/null || true)
  if [ -n "$CHECK_RESULT" ]; then
    UPDATE_READY=$(printf '%s' "$CHECK_RESULT" | field updateReady)
    LOCAL_CHANGES=$(printf '%s' "$CHECK_RESULT" | field localChanges)
    CURRENT_VERSION=$(printf '%s' "$CHECK_RESULT" | field currentVersion)
    PUBLISHED_VERSION=$(printf '%s' "$CHECK_RESULT" | field publishedVersion)
    note "Version check installed=$CURRENT_VERSION published=$PUBLISHED_VERSION ready=$UPDATE_READY localChanges=$LOCAL_CHANGES"
    if [ "$UPDATE_READY" = "true" ] && [ "$LOCAL_CHANGES" = "true" ]; then
      /usr/bin/osascript -e 'display alert "LineWatch update waiting" message "A published update is ready, but tracked local code changes were found. No files were overwritten." as warning'
    elif [ "$UPDATE_READY" = "true" ]; then
      note "Starting automatic update from the LineWatch launcher."
      if /usr/bin/curl -fsS --max-time 10 -X POST "$UPDATE" >/dev/null 2>&1; then
        UPDATE_STATE="running"
        for _ in $(seq 1 90); do
          STATUS_RESULT=$(/usr/bin/curl -fsS --max-time 3 "$STATUS" 2>/dev/null || true)
          UPDATE_STATE=$(printf '%s' "$STATUS_RESULT" | field state)
          if [ "$UPDATE_STATE" = "succeeded" ] || [ "$UPDATE_STATE" = "failed" ]; then break; fi
          /bin/sleep 2
        done
        if [ "$UPDATE_STATE" = "failed" ]; then
          /usr/bin/osascript -e 'display alert "LineWatch update failed" message "The app will open on the installed version. Check ~/Library/Logs/LineWatch-update.log." as critical'
        else
          note "Update completed; waiting for LineWatch to restart."
          for _ in $(seq 1 20); do
            if /usr/bin/curl -fsS --max-time 2 "$CHECK" >/dev/null 2>&1; then break; fi
            /bin/sleep 2
          done
        fi
      else
        /usr/bin/osascript -e 'display alert "LineWatch update could not start" message "The app will open on the installed version." as warning'
      fi
    fi
  fi
  open "$URL"
  exit 0
fi

osascript -e 'display alert "LineWatch could not start" message "Restart the Mac or open the LineWatch launcher again." as critical'
exit 1
