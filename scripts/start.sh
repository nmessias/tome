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

# Optional legacy escape hatch. The normal Royal Road path impersonates Chrome
# and goes out direct, so Tailscale is NOT needed. Set ROYAL_ROAD_USE_TAILSCALE=true
# only if you deliberately want to route the scraper through a tailnet exit node;
# both TS_AUTHKEY and TS_EXIT_NODE must then be set. The exit node must stay
# online: if it disappears, every proxied request fails until the app restarts.
if [ "$ROYAL_ROAD_USE_TAILSCALE" = "true" ]; then
  if [ -z "$TS_AUTHKEY" ] || [ -z "$TS_EXIT_NODE" ]; then
    echo "ROYAL_ROAD_USE_TAILSCALE=true but TS_AUTHKEY/TS_EXIT_NODE are missing - going out direct"
  else
    echo "Joining tailnet, exit node $TS_EXIT_NODE..."
    # In-memory state: the key must be reusable + ephemeral, so every boot is a
    # fresh node that disappears from the tailnet when the machine stops.
    /app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 \
      --state=mem: >/tmp/tailscaled.log 2>&1 &
    for _ in $(seq 20); do [ -S /var/run/tailscale/tailscaled.sock ] && break; sleep 0.5; done
    if /app/tailscale up --auth-key="$TS_AUTHKEY" --hostname=tome-in \
        --exit-node="$TS_EXIT_NODE" --accept-dns=false --timeout=30s; then
      export ROYAL_ROAD_PROXY=socks5://127.0.0.1:1055
      echo "Royal Road proxy enabled via tailnet exit node"
    else
      echo "tailscale up failed - Royal Road will use the direct Chrome-impersonating HTTP path"
      tail -5 /tmp/tailscaled.log
    fi
  fi
fi

# Run database migrations using Bun-native script
# (avoids better-sqlite3 native module compatibility issues)
bun run src/lib/migrate.ts

echo "Starting Tome server..."
exec bun run src/index.ts
