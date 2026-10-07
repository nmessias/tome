FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lock ./

# Frozen lockfile makes the build deterministic (git deps pinned to exact
# commits). Plugins are devDependencies — installed because NODE_ENV is not
# set during build (ENV NODE_ENV=production below is runtime-only). --dev
# keeps them present even if a builder injects NODE_ENV=production.
RUN bun install --frozen-lockfile --dev

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

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
