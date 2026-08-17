FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lock ./

# Frozen lockfile makes the build deterministic (git deps pinned to exact
# commits). Plugins are devDependencies — installed because NODE_ENV is not
# set during build (ENV NODE_ENV=production below is runtime-only). --dev
# keeps them present even if a builder injects NODE_ENV=production.
RUN bun install --frozen-lockfile --dev

# Install Playwright system dependencies and Firefox browser
# (used by the royalroad plugin for Cloudflare bypass and auto-login)
RUN bunx playwright install-deps firefox && bunx playwright install firefox

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
