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

# Cloudflare challenges Fly's datacenter IP forever but lets a home/mobile IP
# straight through - it judges the IP, not the browser. When TS_AUTHKEY and
# TS_EXIT_NODE are set, join the tailnet and hand the Royal Road browser a SOCKS5
# proxy that leaves via that exit node. Opt-in: unset, nothing changes.
if [ -n "$TS_AUTHKEY" ] && [ -n "$TS_EXIT_NODE" ]; then
  echo "Joining tailnet, exit node $TS_EXIT_NODE..."
  # In-memory state: the key must be reusable + ephemeral, so every boot is a
  # fresh node that disappears from the tailnet when the machine stops.
  /app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 \
    --state=mem: >/tmp/tailscaled.log 2>&1 &
  for _ in $(seq 20); do [ -S /var/run/tailscale/tailscaled.sock ] && break; sleep 0.5; done
  if /app/tailscale up --auth-key="$TS_AUTHKEY" --hostname=tome-in \
      --exit-node="$TS_EXIT_NODE" --accept-dns=false --timeout=30s; then
    export ROYAL_ROAD_PROXY=socks5://127.0.0.1:1055
  else
    echo "tailscale up failed - Royal Road will go out direct and get challenged"
    tail -5 /tmp/tailscaled.log
  fi
fi

# Run database migrations using Bun-native script
# (avoids better-sqlite3 native module compatibility issues)
bun run src/lib/migrate.ts

echo "Starting Tome server..."
exec bun run src/index.ts
