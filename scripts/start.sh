#!/bin/bash
set -e

echo "=== Tome Startup ==="

# Ensure data directory exists
mkdir -p /app/data

# Cloudflare rejects the scraper's browser when it runs headless, so the Royal
# Road plugin drives a real Chromium window (ROYAL_ROAD_HEADLESS defaults to
# false). In a container that requires a virtual display.
if [ "$ROYAL_ROAD_HEADLESS" != "true" ] && [ -z "$DISPLAY" ] && command -v Xvfb >/dev/null 2>&1; then
  echo "Starting Xvfb on :99 for the headful browser..."
  Xvfb :99 -screen 0 1280x800x24 >/tmp/xvfb.log 2>&1 &
  export DISPLAY=:99
  sleep 1
fi

# Run database migrations using Bun-native script
# (avoids better-sqlite3 native module compatibility issues)
bun run src/lib/migrate.ts

echo "Starting Tome server..."
exec bun run src/index.ts
