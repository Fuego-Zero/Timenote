FROM node:22.23.2-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@10.28.0
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build \
    && rm -rf node_modules \
    && CI=true pnpm install --prod --offline --frozen-lockfile \
    && rm -rf /root/.local/share/pnpm/store \
    && rm -rf node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/deps \
              node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3/src

FROM node:22.23.2-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /data/logs /app/.tmp/logs \
    && chown -R node:node /data /app/.tmp \
    && chmod 700 /data
USER node
ENV NODE_ENV=production SQLITE_PATH=/data/timenote.sqlite LOG_DIR=/data/logs WEB_BIND_HOST=0.0.0.0
EXPOSE 8720
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "Promise.all([8720,8721].map(p=>fetch('http://127.0.0.1:'+p+(p===8720?'/':'/health')).then(r=>{if(!r.ok)throw Error()}))).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "scripts/start.ts"]
