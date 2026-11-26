import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { AppEnv } from '@/container';
import type { SequencedEvent } from '@/EventBus';

const KEEPALIVE_MS = 15_000;

/**
 * Stream bus events as SSE. Sends the current printer state first, then replays
 * anything after `Last-Event-ID`, then streams live events that pass `filter`.
 */
export function streamEvents(c: Context<AppEnv>, filter: (e: SequencedEvent) => boolean = () => true) {
  // Resolve before streaming: the request scope is disposed when the handler returns, while the
  // stream lives on. Both are root singletons, so they outlive the scope.
  const bus = c.var.di.get('eventBus');
  const queue = c.var.di.get('printQueue');
  const lastId = Number(c.req.header('last-event-id') ?? 0);

  return streamSSE(c, async (stream) => {
    const send = (e: SequencedEvent) =>
      stream.writeSSE({ id: String(e.id), event: e.event.type, data: JSON.stringify(e.event) });

    await stream.writeSSE({ event: 'printer', data: JSON.stringify(queue.printerEvent()) });

    for (const e of bus.since(lastId)) {
      if (filter(e)) {
        await send(e);
      }
    }

    const onEvent = (e: SequencedEvent) => {
      if (filter(e)) {
        void send(e);
      }
    };

    bus.on('event', onEvent);

    stream.onAbort(() => {
      bus.off('event', onEvent);
    });

    while (!stream.aborted) {
      await stream.sleep(KEEPALIVE_MS);
      await stream.writeSSE({ event: 'ping', data: '' });
    }
  });
}
