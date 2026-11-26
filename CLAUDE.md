# p0s

A "print anything" service for an Epson TM-T20II USB receipt printer: a Hono API (`apps/api`) and a
React web UI (`apps/web`). The full design is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Commands

```bash
pnpm dev                          # API (tsx watch) + web
pnpm typecheck                    # all packages
pnpm lint / pnpm format           # biome check / biome check --write
pnpm --filter @p0s/api test:hardware   # calibration receipt on the real printer (never in CI)
pnpm --filter @p0s/api db:seed        # one-shot: add the starter templates (skips existing ones)
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
- **The web app talks to the API through `ApiClient`** (`apps/web/src/api`), a class over Hono RPC
  (`hc<AppType>` + `parseResponse`): requests and responses are typed from the API's own routes, so changing a
  route breaks the web build. Keep controller routes chained so `AppType` carries them. Live updates come from
  `ServerEvents`, which writes SSE events straight into the TanStack Query cache.
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
- Keep comments minimal; explain _why_, not _what_.
