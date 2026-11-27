# p0s

A "print anything" service for an Epson TM-T20II USB receipt printer: a Hono API (`apps/api`) and a
React web UI (`apps/web`). The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Commands

```bash
pnpm dev                          # API (tsx watch) + web
pnpm typecheck                    # all packages
pnpm test                         # Vitest: API (unit, queue, HTTP) + web; no hardware needed
pnpm lint / pnpm format           # biome check / biome check --write
pnpm --filter @p0s/api test:hardware   # calibration receipt on the real printer (never in CI)
pnpm --filter @p0s/api db:seed        # one-shot: add the starter templates (skips existing ones)
pnpm --filter @moonthug/p0s-client generate   # after changing routes: refresh the client's route types
```

The API reads `apps/api/.env` (copy `.env.example`). `PRINTER=fake` runs without the hardware.
Dev ports: API 3300 (3000 is taken by Rancher Desktop), web 5300 (Vite proxies `/api` → 3300), Sidequest dashboard 8678.
Stop dev servers with `pkill -f "tsx/dist/cli.mjs watch"`: `pkill -f "tsx watch"` doesn't match the watcher.

## Conventions

- **Libraries first.** Check npm for a maintained library before hand-rolling infrastructure
  (queues, validation, ORM, parsing). Hand-rolled pieces are listed in `docs/DESIGN.md` with the reason.
- **Favour OOP for services.** Services are classes with constructor-injected dependencies (`UsbPrinter`,
  `PrintQueue`, `EventBus`, `ReceiptRenderer`, `Database`, `Server`). Use TypeScript `private`, never `#private`.
- **Dependency injection is InferDI.** `src/container.ts` is the composition root: it registers every service
  (`registerClass` / `registerFactory`) and is the only place that knows how they're built. Services take plain
  constructor arguments and never import InferDI. Lifecycle classes implement `[Symbol.asyncDispose]`, so
  `container.dispose()` shuts everything down in reverse creation order.
- **The HTTP layer is functions, not classes.** `createApp(container)` in `src/app.ts` adds the `@inferdi/hono`
  middleware, then mounts one controller per area from `src/routes/` (`statusRoutes`, `printRoutes`, …). Each
  controller is a `Hono<AppEnv>` sub-app that gets services with `c.var.di.get('printQueue')`.
- **Every route is documented.** Give it a `describeRoute({ tags, summary, responses })` and validate input with
  `validate()` from `src/routes/openapi.ts` (hono-openapi's validator, answering failures as `{ error }`), never
  `zValidator`. Response shapes are zod schemas in `@p0s/shared` with a `.meta({ id })`. The spec is generated at
  `/openapi.json` and shown with Swagger UI at `/docs` (the web app's API page embeds it; its assets load from
  the jsDelivr CDN). Work that outlives
  the request (SSE) must resolve its services before the handler returns: the request scope is disposed then.
- **The API client is `@moonthug/p0s-client`** (`packages/client`): `P0sClient`, a class over Hono RPC
  (`hc<AppType>` + `parseResponse`), used by the web app and published to GitHub Packages for scripts.
  `AppType` is the type of `apiRoutes` (`apps/api/src/routes/api.ts`): a plain `new Hono()` route tree, so its type
  carries only route inputs/outputs and references nothing but `hono`. The client keeps a generated copy in
  `src/generated/routes.ts`. **After changing any route, run `pnpm --filter @moonthug/p0s-client generate`**; CI
  fails if it's stale. Keep middleware out of `apiRoutes` (add it in `createApp`), or `AppType` drags in server
  types. To release the client, bump its `version`: CI publishes any version not yet on GitHub Packages. Live
  updates come from `ServerEvents` in the web app, which writes SSE events straight into the TanStack Query cache.
- **MCP** is served at `/mcp` (Streamable HTTP, stateless, JSON responses), wired up in `createApp`. The tools in
  `src/mcp/mcpServer.ts` call the API in-process through `P0sClient` (its `fetch` is `app.request`), so they share
  the routes' validation and errors; `src/mcp/instructions.ts` teaches the model ReceiptLine and the template
  syntax. Print tools wait up to 20 s for the job and say whether it printed or what the printer is waiting on.
  Add a tool when you add a route worth exposing. Connect with
  `claude mcp add --transport http p0s http://berry.local:8080/api/mcp`.
- **A class lives in a file named after it** (`class PrintQueue` → `PrintQueue.ts`), enforced by the
  `biome-plugins/class-filename.grit` plugin. Other files are camelCase.
- **Relative imports, no path aliases.** The web app type-checks the API's source for `hc<AppType>`, and a
  per-package alias like `@/` would resolve against the wrong package. No `.js` suffixes (`moduleResolution:
  bundler`, run by `tsx`).
- **Import order** (Biome): Node builtins → packages → `@p0s/*` → relative, separated by blank lines.
- **Formatting** (Biome): single quotes, semicolons, 2-space indent, 120 columns, braces on every `if`/loop body.
- **Space code into logical steps.** Biome has no rule for this, so follow it by hand:
  - a blank line before `return`, unless it's the first statement in its block;
  - a blank line after a block (`if`, `try`, loop) when more statements follow;
  - a blank line between the steps of a method (e.g. build the row → persist → enqueue → publish).
- **Tests** live in each app's `test/`. API tests use `FakePrinter` and a temp SQLite file, never the USB printer.
  Sidequest is a process-wide singleton, so API test files run one at a time, and Vitest inlines Sidequest so its
  `import()` of `PrintJob` shares the test's module instance. `ReceiptRenderer.test.ts` snapshots ESC/POS bytes:
  if it changes after a ReceiptLine upgrade, check a real print before updating the snapshot.
- **CI** (`.github/workflows/ci.yml`): `biome ci`, typecheck, tests and the web build on every push and PR. Then each
  Docker image is built for arm64 (Raspberry Pi) on a native ARM runner, smoke-tested (the API with `PRINTER=fake`), and on `main` pushed to
  `ghcr.io/moonthug/p0s-api` / `p0s-web` as `latest` and `sha-<commit>`.
- **Docker**: `apps/api/Dockerfile` (node:24-slim, glibc for the native modules; runs the TS source with tsx because
  Sidequest loads `PrintJob.ts` by path, so `tsx` is a runtime dependency) and `apps/web/Dockerfile` (Vite build →
  nginx, which proxies `/api/` to `API_UPSTREAM` with SSE buffering off). `docker-compose.yml` is for the Linux home
  lab: it bind-mounts `/dev/bus/usb` with a cgroup rule for USB (char major 189) so replugging the printer works.
  Both build from the repo root.
- **HTTPS and CORS** (both in `docker-compose.yml`): a Caddy service serves `https://${P0S_HOST}` (default
  `berry.local`) with its own local CA (`tls internal`; devices trust its root once, see the compose comments), with
  the Caddyfile inline via `configs:`. Browser calls from other sites are allowed only for origins in
  `P0S_CORS_ORIGINS` (→ API `CORS_ORIGINS`), via `src/middleware/cors.ts`, which also answers Chrome's
  private-network preflight. Both are set in a `.env` beside the compose file.
- Keep comments minimal; explain _why_, not _what_.
