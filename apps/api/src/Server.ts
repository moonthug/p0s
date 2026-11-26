import { type ServerType, serve } from '@hono/node-server';

import { createApp } from './app';
import type { Config } from './config';
import { type AppContainer, buildContainer } from './container';

/** Owns the process lifecycle: builds the container, starts the hardware and queue, serves HTTP. */
export class Server {
  private readonly container: AppContainer;
  private http: ServerType | null = null;

  constructor(private readonly cfg: Config) {
    this.container = buildContainer(cfg);
  }

  async start() {
    await this.container.get('printer').start();
    await this.container.get('printQueue').start();

    const app = createApp(this.container);

    this.http = serve({ fetch: app.fetch, port: this.cfg.PORT }, (info) =>
      console.log(`[api] listening on :${info.port} (printer=${this.cfg.PRINTER})`),
    );
  }

  /** Stops HTTP, then lets the container dispose the queue, printer and database in reverse order. */
  async stop() {
    this.http?.close();
    await this.container.dispose();
  }
}
