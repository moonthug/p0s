# p0s — design

A "print anything" service for an **Epson TM-T20II** (80 mm thermal, USB, ESC/POS), with a web UI.
Runs in Docker in a home lab. Single printer. **No auth** — the home network is the trust boundary.

## Principle: libraries first

Check npm for a maintained library before hand-rolling anything. Hand-rolled pieces are listed below with the reason.

| Concern                                | Library                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| HTTP                                   | `hono`, `@hono/node-server`, `@hono/zod-validator`, Hono `streamSSE`                      |
| Dependency injection                   | `@inferdi/inferdi` + `@inferdi/hono` (request scope on `c.var.di`)                        |
| Validation / shared types              | `zod` (in `packages/shared`); web uses a typed `ApiClient` class                          |
| Receipt markup → ESC/POS + SVG preview | `receiptline`                                                                             |
| Job queue                              | `sidequest` + `@sidequest/sqlite-backend` (same SQLite file; built-in dashboard)          |
| Persistence (history, templates)       | `drizzle-orm` + `better-sqlite3`, migrations via `drizzle-kit`                            |
| Templates                              | `mustache`                                                                                |
| Image processing                       | `sharp` (resize/greyscale/normalise); ReceiptLine does dithering/threshold                |
| USB                                    | `usb` (libusb)                                                                            |
| Web                                    | Vite, React, TypeScript, Tailwind v4, daisyUI v5, TanStack Query, `@uiw/react-codemirror` |
| Lint/format, tests, CI                 | Biome, Vitest, GitHub Actions                                                             |

**Hand-rolled:** the USB printer transport + ESC/POS real-time status decoding (`DLE EOT n`).
Existing wrappers (`@node-escpos/usb-adapter`, last release 2023; `escpos-usb`, 2022) are stale thin layers
over `usb` and don't decode status.

## Repo layout (pnpm workspaces)

```
apps/api         Hono API, printer transport, Sidequest queue, SQLite
apps/web         Vite + React UI (served by nginx in prod)
packages/shared  zod schemas, shared types
docker-compose.yml   api · web
```

## Deployment

`docker-compose.yml`, two services (no Redis — the queue lives in SQLite):

- **api** — `node:24-slim` (Debian/glibc; `usb` prebuilds aren't musl). `devices: /dev/bus/usb`. SQLite in a named volume.
  Must run on a **Linux** host (Docker Desktop on macOS can't pass USB through). Starts fine without the printer and reconnects on hot-plug.
- **web** — nginx serving the Vite build; proxies `/api/*` → `api:3000`. Same-origin, so no CORS.

Dev on macOS: `pnpm dev` runs the API (`tsx watch`) and Vite. The Vite proxy mirrors nginx `/api`.

## Printer

- `Printer` interface: `write(bytes)`, `status()`, and status events. Implementations: `UsbPrinter` (VID `0x04b8`, PID `0x0e15`) and `FakePrinter` (simulated latency; `FAKE_FAULT=paper-out|cover-open|offline`). Selected with `PRINTER=usb|fake`.
- Every USB transfer has a timeout. A wedged printer must never hang the process.
- Status is polled while idle (`DLE EOT 1–4`) and decoded into `{ online, coverOpen, paperNearEnd, paperOut, error }`. Changes are emitted as events.
- A disconnect is detected through `usb` attach/detach events and the device is re-opened automatically.
- Encoding `cp858` (has £ and €). Emoji can't be printed in device fonts; the text endpoint drops them.

## Jobs (Sidequest)

- One Sidequest queue, `print`, at **concurrency 1** (one printer, one USB claim).
- Sidequest runs **inline in the API process** (`fork: false`, `runner: "inline"`), so `PrintJob` can reach the live `UsbPrinter`. Because Sidequest constructs the job class itself, `PrintQueue` registers its processor on `PrintJob` statically.
- Sidequest uses its own Knex connection to the same SQLite file (WAL).
- **Async only.** Every print endpoint renders to ESC/POS up front (so bad input is rejected with `400` immediately), writes a history row, enqueues, and returns `202 { jobId }`.
- **Hold & resume.** On a printer fault (offline, paper out, cover open) the head job stays _active_ and waits for the printer, so order is preserved. Jobs behind it stay `queued`, and a `waiting` reason is published on the printer event. When status recovers, it prints and the queue carries on.
- **Cutoff.** Each job has a deadline of `createdAt + JOB_MAX_WAIT` (default 10 min). Past it the job fails with `expired`, so a stale pile doesn't print hours later.
- `maxAttempts: 1`. The job timeout and Sidequest's stale-job threshold are set to the wait window plus headroom, so a waiting head job isn't released and run again.
- On startup, any job still marked `printing` (the process died mid-write) is marked `failed`, never re-sent. The processor ignores any job that isn't `queued`, so a duplicate delivery is harmless.
- Cancel: our row is set to `cancelled` and `Sidequest.job.cancel()` is called. If the job is already waiting on the printer, it sees `abortSignal` and stops.
- **No re-sends.** Once the bytes are written the job is `printed`. If paper runs out mid-receipt the printer finishes it from its buffer after reload. Retrying would duplicate output.
- Statuses: `queued → printing → printed | failed | cancelled`. Cancel works only while queued.

## API

All print endpoints return `202 { jobId }`. Every route except raw also has a preview counterpart, all through ReceiptLine (`cpl: 48`, `command: "escpos"` for print, `"svg"` for preview).

| Method & path                                                  | Body               | Notes                                                   |
| -------------------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| `POST /print`                                                  | ReceiptLine doc    |                                                         |
| `POST /print/text`                                             | plain text         | escaped → ReceiptLine                                   |
| `POST /print/image`                                            | multipart PNG/JPEG | `mode=auto\|photo\|line`, `width`, `rotate`, `force`    |
| `POST /print/raw`                                              | bytes              | passthrough, no preview                                 |
| `POST /preview` (and `/preview/text`, `/preview/image`)        | as above           | returns SVG + estimated paper length                    |
| `GET /status`                                                  |                    | current printer status + queue counts                   |
| `GET /events`                                                  |                    | **SSE**: printer + job events; supports `Last-Event-ID` |
| `GET /jobs`, `GET /jobs/:id`                                   |                    | history (SQLite)                                        |
| `GET /jobs/:id/events`                                         |                    | SSE for one job                                         |
| `POST /jobs/:id/reprint`, `POST /jobs/:id/cancel`              |                    |                                                         |
| `GET/POST /templates`, `GET/PUT/DELETE /templates/:name`       |                    |                                                         |
| `POST /templates/:name/print`, `POST /templates/:name/preview` | variables JSON     |                                                         |
| Sidequest dashboard on `QUEUE_DASHBOARD_PORT` (8678)           |                    | queue internals                                         |

### Images

`sharp`: auto-orient → greyscale → normalise → resize to ≤ 576 dots wide (never upscale; `width` as % of paper) → optional `rotate` / rotate-to-fit.
`mode=auto` uses dithering (ReceiptLine `gradient: true`) for photographic images and threshold for low-colour images (logos, screenshots, QR codes).
**Length guard:** output taller than ~2000 dots (~25 cm) is rejected without `force=true`.
History stores the **processed** PNG, not the original, so reprints are identical.

### Templates

Stored in SQLite (`name`, `title`, `body`, `sample` JSON), managed in the UI. Rendered with **Mustache** and then ReceiptLine.
`{{var}}` is escaped for ReceiptLine (`| { } - = ~ _ " \` ^ \` and leading `-`/`=` lines); `{{{var}}}` inserts raw markup.
The default `{{ }}` delimiters don't collide with ReceiptLine `{key:value}` properties. Edge cases (`{{{`) are covered by tests.

## Persistence (SQLite, Drizzle)

- `jobs` — id (uuid), `queue_job_id` (Sidequest id), kind (`receiptline|text|image|raw|template`), source (doc text or processed PNG), template name + vars, status, error, timestamps. Optional pruning via `HISTORY_DAYS`.
- `templates` — name (PK), title, body, sample, timestamps.

Sidequest's tables (`sidequest_*`, in the same file) hold execution state. Our `jobs` table is the record the API and UI read.

## Web UI — v1

1. **Status bar** — online / paper / cover, queue depth (live via `/events`).
2. **Compose** — CodeMirror ReceiptLine editor, live SVG preview at paper width, paper-length estimate, Print.
3. **Quick print** — text box; image drag-drop / clipboard paste with mode toggle + preview.
4. **Jobs** — live queue + history, source preview, reprint, cancel.
5. **Templates** — list, editor with sample-data preview, auto-generated "Print with…" form, "copy as curl".

Later: raw ESC/POS sender, settings page.

## Testing

- Vitest throughout. API tests use `app.request()` with `FakePrinter`, and a temp-file SQLite DB (no external services).
- Covered: queue ordering, hold & resume, cutoff expiry, SSE events, template escaping, image length guard.
- Snapshot tests of ESC/POS bytes for fixed ReceiptLine docs (guards ReceiptLine upgrades).
- `pnpm test:hardware` (manual, never in CI): a calibration receipt with styles, columns, QR, barcode, image, cut.
- CI: GitHub Actions — Biome, typecheck, tests, both Docker image builds.

## Config (env)

`PORT` (3000), `PRINTER` (`usb|fake`), `DB_PATH`, `QUEUE_DASHBOARD_PORT` (8678; 0 = off), `JOB_MAX_WAIT` (600s), `HISTORY_DAYS` (unset = keep forever), `ENCODING` (`cp858`), `FAKE_FAULT`.
