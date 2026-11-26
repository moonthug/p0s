# p0s web UI. Build from the repo root: docker build -f apps/web/Dockerfile .
# Builds the Vite app, then serves it with nginx, which also proxies /api to the API container.

FROM node:24-slim AS build
RUN npm install --global pnpm@12.8.1
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
# Nothing the web app needs runs install scripts (no native modules).
RUN pnpm install --frozen-lockfile --filter @p0s/web... --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/client packages/client
COPY apps/web apps/web
RUN pnpm --filter @p0s/web build

FROM nginx:1.29-alpine

# nginx renders templates/*.template with these variables at startup.
ENV API_UPSTREAM=http://api:3000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
