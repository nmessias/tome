#!/bin/bash
set -e

echo "=== Tome Startup ==="

# Ensure data directory exists
mkdir -p /app/data

# Chrome reserves 512MB of *virtual* address space per renderer for V8's code
# range. Fly's kernel uses heuristic overcommit, and on a small machine that
# reservation is refused with "V8 process OOM (Failed to reserve virtual memory
# for CodeRange)" - the browser starts but every page target dies, which looks
# exactly like a Cloudflare block. Overcommit accounting is not what protects
# this VM (its size is), so let the mapping through. Not fatal if the container
# cannot write the sysctl (it is also set on headful/dev machines).
if [ -w /proc/sys/vm/overcommit_memory ]; then
  echo 1 > /proc/sys/vm/overcommit_memory 2>/dev/null \
    && echo "vm.overcommit_memory=1 (Chrome V8 code range reservations)" \
    || echo "could not set vm.overcommit_memory - Chrome may fail to start on small machines"
fi

# Only a headful browser (ENABLE_BROWSER=true with ROYAL_ROAD_HEADLESS=false,
# for local debugging) needs a virtual display; the plugin defaults to headless.
if [ "$ENABLE_BROWSER" = "true" ] && [ "$ROYAL_ROAD_HEADLESS" = "false" ] && [ -z "$DISPLAY" ] && command -v Xvfb >/dev/null 2>&1; then
  echo "Starting Xvfb on :99 for the headful browser..."
  Xvfb :99 -screen 0 1280x800x24 >/tmp/xvfb.log 2>&1 &
  export DISPLAY=:99
  sleep 1
fi

# Optional Tailscale egress routing for Royal Road. It needs a configured exit
# node. The exit node must remain online for proxied requests to work.
if [ "$ROYAL_ROAD_USE_TAILSCALE" = "true" ]; then
  if [ -z "$TS_AUTHKEY" ] || [ -z "$TS_EXIT_NODE" ]; then
    echo "ROYAL_ROAD_USE_TAILSCALE=true but TS_AUTHKEY/TS_EXIT_NODE are missing - going out direct"
    unset ROYAL_ROAD_PROXY
  else
    echo "Joining tailnet, exit node $TS_EXIT_NODE..."
    # In-memory state: the key must be reusable + ephemeral, so every boot is a
    # fresh node that disappears from the tailnet when the machine stops.
    /app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 \
      --state=mem: >/tmp/tailscaled.log 2>&1 &
    for _ in $(seq 20); do [ -S /var/run/tailscale/tailscaled.sock ] && break; sleep 0.5; done
    if /app/tailscale up --auth-key="$TS_AUTHKEY" --hostname=tome-in \
        --exit-node="$TS_EXIT_NODE" --accept-dns=false --timeout=30s; then
      if [ "$ENABLE_BROWSER" != "true" ]; then
        # The HTTP client resolves hostnames itself and connects by address,
        # which tailscaled's SOCKS server accepts; only Chromium (which hands
        # it hostnames) needs the bridge - and a second Bun runtime (~30MB).
        export ROYAL_ROAD_PROXY=socks5://127.0.0.1:1055
        echo "Royal Road proxy enabled via Tailscale"
      else
      echo "Starting Royal Road DNS-aware SOCKS bridge..."
      bun --smol run scripts/tailscale-socks5-bridge.ts >/tmp/tailscale-socks5-bridge.log 2>&1 &
      SOCKS_BRIDGE_PID=$!
      SOCKS_BRIDGE_READY=false
      for _ in $(seq 20); do
        if grep -q "listening on 127.0.0.1:1056" /tmp/tailscale-socks5-bridge.log; then
          SOCKS_BRIDGE_READY=true
          break
        fi
        if ! kill -0 "$SOCKS_BRIDGE_PID" 2>/dev/null; then
          break
        fi
        sleep 0.25
      done
      if [ "$SOCKS_BRIDGE_READY" = "true" ]; then
        export ROYAL_ROAD_PROXY=socks5://127.0.0.1:1056
        echo "Royal Road proxy enabled via Tailscale and DNS bridge"
      else
        echo "Royal Road DNS bridge failed to start; using direct egress"
        cat /tmp/tailscale-socks5-bridge.log || true
        unset ROYAL_ROAD_PROXY
      fi
      fi
    else
      echo "tailscale up failed - Royal Road will go out direct (and be challenged)"
      unset ROYAL_ROAD_PROXY
      tail -5 /tmp/tailscaled.log
    fi
  fi
fi

# Run database migrations using Bun-native script
# (avoids better-sqlite3 native module compatibility issues)
bun run src/lib/migrate.ts

echo "Starting Tome server..."
exec bun --smol run src/index.ts
