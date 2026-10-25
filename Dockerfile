FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lock ./

# Frozen lockfile makes the build deterministic (git deps pinned to exact
# commits). Plugins are devDependencies — installed because NODE_ENV is not
# set during build (ENV NODE_ENV=production below is runtime-only). --dev
# keeps them present even if a builder injects NODE_ENV=production.
#
# --ignore-scripts: `better-sqlite3` arrives transitively through the plugin's
# `tome` package, but the server uses bun:sqlite at runtime (only the Node CLI
# auth helper imports better-sqlite3). Its install script tries to compile
# against Bun's Node ABI and fails in this image without a Python toolchain.
# impit and Playwright ship prebuilt binaries, so no lifecycle script is needed.
RUN bun install --frozen-lockfile --dev --ignore-scripts

# Install Playwright system dependencies and Chromium
# (used by the royalroad plugin for Cloudflare bypass and auto-login).
#
# Chromium only, and headful: Cloudflare rejects the Royal Road login POST for
# both Firefox and headless Chromium, so auto-login needs a real Chromium
# window against an Xvfb display (scripts/start.sh starts it). Firefox was
# dropped because it cannot log in at all - it only ever cost image size and
# build time. Set ROYAL_ROAD_BROWSER=firefox to re-add it via a custom image.
#
# xvfb comes from apt; it is not a Playwright install-deps target.
RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb \
    && bunx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Tailscale, userspace mode: kept only for the explicit opt-in escape hatch in
# scripts/start.sh (ROYAL_ROAD_USE_TAILSCALE=true). The normal Royal Road HTTP
# path uses Chrome TLS impersonation and goes out direct, so Tailscale is not
# started unless that variable is set. Static Go binaries, so they run fine on
# this Debian base. Pinned for the same reason bun.lock is frozen.
COPY --from=docker.io/tailscale/tailscale:v1.102.5 /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:v1.102.5 /usr/local/bin/tailscale /app/tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
