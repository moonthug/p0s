import { loadConfig } from './config';
import { Server } from './Server';

const server = new Server(loadConfig());
await server.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
