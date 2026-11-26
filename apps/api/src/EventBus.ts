import { EventEmitter } from 'node:events';

import type { ServerEvent } from '@p0s/shared';

export type SequencedEvent = { id: number; event: ServerEvent };

/**
 * In-process fan-out for SSE. Keeps a short replay buffer so reconnecting
 * clients can resume from `Last-Event-ID`.
 */
export class EventBus extends EventEmitter<{ event: [SequencedEvent] }> {
  private seq = 0;
  private buffer: SequencedEvent[] = [];

  constructor(private readonly replaySize = 500) {
    super();
    this.setMaxListeners(0);
  }

  publish(event: ServerEvent) {
    const e = { id: ++this.seq, event };

    this.buffer.push(e);
    if (this.buffer.length > this.replaySize) {
      this.buffer.shift();
    }

    this.emit('event', e);
  }

  /** Events after `lastId`, oldest first. */
  since(lastId: number) {
    return this.buffer.filter((e) => e.id > lastId);
  }
}
