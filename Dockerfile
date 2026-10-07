FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lock ./

# Frozen lockfile makes the build deterministic (git deps pinned to exact
# commits). Plugins are devDependencies — installed because NODE_ENV is not
# set during build (ENV NODE_ENV=production below is runtime-only). --dev
# keeps them present even if a builder injects NODE_ENV=production.
RUN bun install --frozen-lockfile --dev

# Install Playwright system dependencies and browsers
# (used by the royalroad plugin for Cloudflare bypass and auto-login).
# Chromium is the engine Cloudflare tolerates: headless Chromium and Firefox
# both get the login POST rejected. Firefox stays installed as a fallback
# (ROYAL_ROAD_BROWSER=firefox).
RUN bunx playwright install-deps chromium firefox xvfb \
    && bunx playwright install chromium firefox \
    && apt-get update && apt-get install -y --no-install-recommends xvfb \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
