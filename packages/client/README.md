# @moonthug/p0s-client

Typed client for [p0s](https://github.com/moonthug/p0s), the API for an Epson TM-T20II receipt printer.
It's built on [Hono RPC](https://hono.dev/docs/guides/rpc): request and response types come straight from the
API's routes, so they're exactly what the server accepts and returns.

## Install

The package is on GitHub Packages, which needs a token even for public packages. Create a
[classic personal access token](https://github.com/settings/tokens) with the `read:packages` scope, then add an
`.npmrc` next to your `package.json`:

```ini
@moonthug:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```sh
GITHUB_TOKEN=<your token> npm install @moonthug/p0s-client
```

## Use

```ts
import { P0sClient, P0sError } from '@moonthug/p0s-client';

const p0s = new P0sClient('http://berry.local:8080/api');

// A saved template, filled in
await p0s.printTemplate('shopping-list', { items: ['Milk', 'Eggs'] });

// A ReceiptLine document
const job = await p0s.print('^^Hello\n-\nFrom a script');

// An image (any Blob or File)
await p0s.printImage(new Blob([png], { type: 'image/png' }), { mode: 'photo', width: 80 });

// Printer status and history
const { printer, queue } = await p0s.status();
const recent = await p0s.jobs(10);

try {
  await p0s.print('');
} catch (err) {
  if (err instanceof P0sError) {
    console.error(err.status, err.message); // 400 doc: Too small: expected string to have >=1 characters
  }
}
```

Anything without a method is on `p0s.rpc`, the raw typed Hono client:

```ts
const res = await p0s.rpc.jobs[':id'].$get({ param: { id: job.id } });
```

Live updates are a server-sent events stream: `new EventSource(p0s.eventsUrl())`.

Pass a custom `fetch` or default `headers` as the second argument, e.g.
`new P0sClient(url, { headers: { 'x-source': 'home-assistant' } })`.
