#!/bin/bash
# Linewatch — Chris Decker
# Double-click in Finder. This Mac becomes house DNS.
set -e
cd "$(dirname "$0")/../.."
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js from https://nodejs.org then double-click again."
  read -r _
  exit 1
fi

ROOT="$PWD"
NODE_BIN="$(command -v node)"
PLIST_TMP="$(mktemp /tmp/linewatch-plist.XXXXXX)"
STAGE_DIR="$(mktemp -d /tmp/linewatch-stage.XXXXXX)"
SCRIPT_TMP="/tmp/linewatch-install-$$.sh"
cleanup() { rm -f "$PLIST_TMP" "$SCRIPT_TMP"; rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

# Copy out of Documents before elevation. macOS privacy controls can prevent
# an administrator process launched by AppleScript from reading Documents.
cp -R "$ROOT/collector" "$STAGE_DIR/collector"

xml_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

NODE_XML="$(xml_escape "$NODE_BIN")"
cat > "$PLIST_TMP" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.linewatch.collector</string>
  <key>ProgramArguments</key><array><string>$NODE_XML</string><string>/Library/Application Support/Linewatch/app/collector/linewatch-collector.mjs</string></array>
  <key>WorkingDirectory</key><string>/Library/Application Support/Linewatch/app</string>
  <key>EnvironmentVariables</key><dict><key>LINEWATCH_DATA</key><string>/Library/Application Support/Linewatch</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Library/Logs/Linewatch.log</string>
  <key>StandardErrorPath</key><string>/Library/Logs/Linewatch-error.log</string>
</dict></plist>
EOF

echo "Linewatch needs your Mac password once to install its always-on DNS service."
{
  echo '#!/bin/bash'
  echo 'set -e'
  printf 'SOURCE=%q\n' "$STAGE_DIR/collector"
  printf 'PLIST=%q\n' "$PLIST_TMP"
  cat <<'ROOT_SCRIPT'
mkdir -p '/Library/Application Support/Linewatch/app'
rm -rf '/Library/Application Support/Linewatch/app/collector'
cp -R "$SOURCE" '/Library/Application Support/Linewatch/app/collector'
install -o root -g wheel -m 644 "$PLIST" /Library/LaunchDaemons/com.linewatch.collector.plist
launchctl bootout system/com.linewatch.collector >/dev/null 2>&1 || true
launchctl bootstrap system /Library/LaunchDaemons/com.linewatch.collector.plist
launchctl enable system/com.linewatch.collector
ROOT_SCRIPT
} > "$SCRIPT_TMP"
chmod 700 "$SCRIPT_TMP"
osascript - "$SCRIPT_TMP" <<'APPLESCRIPT'
on run argv
  do shell script "/bin/bash " & quoted form of (item 1 of argv) with administrator privileges
end run
APPLESCRIPT
exec "$NODE_BIN" install/setup.mjs --desk-only
