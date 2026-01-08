FROM oven/bun:1-debian

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile || bun install

COPY . .

RUN mkdir -p /app/data

RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

ENV NODE_ENV=production

CMD ["/app/scripts/start.sh"]
