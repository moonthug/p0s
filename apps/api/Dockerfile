# p0s API. Build from the repo root: docker build -f apps/api/Dockerfile .
#
# Debian (glibc), not Alpine: the usb, better-sqlite3 and sharp prebuilt binaries are glibc-only.
# Runs the TypeScript source with tsx rather than a bundle: Sidequest loads PrintJob.ts by its file path.

FROM node:24-slim AS base
RUN npm install --global pnpm@12.8.1
WORKDIR /app

FROM base AS deps
# Only needed if a native module has no prebuilt binary for this platform and must compile.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Manifests first, so dependencies are only reinstalled when they change.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile --prod --filter @p0s/api...

FROM node:24-slim
WORKDIR /app

COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
# The MCP tools call the API in-process through the typed client.
COPY packages/client packages/client
COPY apps/api apps/api

WORKDIR /app/apps/api

ENV NODE_ENV=production \
  PORT=3000 \
  PRINTER=usb \
  DB_PATH=/data/p0s.db \
  QUEUE_DASHBOARD_PORT=0

# SQLite: job history, templates and the queue.
VOLUME /data
EXPOSE 3000

# Runs as root so it can open the USB device passed in from the host (see docker-compose.yml).
# node is PID 1 and handles SIGTERM itself: it stops the queue, releases the printer and closes the database.
CMD ["node", "--import", "tsx", "src/index.ts"]
