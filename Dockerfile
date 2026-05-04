FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile || bun install

# Install Playwright system dependencies and Firefox browser
# (used for Cloudflare bypass and auto-login)
RUN bunx playwright install-deps firefox && bunx playwright install firefox

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
