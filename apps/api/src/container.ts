import type { InferdiHonoEnv } from '@inferdi/hono';
import { Container } from '@inferdi/inferdi';

import type { Config } from '@/config';
import { Database } from '@/db/Database';
import { EventBus } from '@/EventBus';
import { PrintQueue, type PrintQueueOptions } from '@/PrintQueue';
import { createPrinter } from '@/printer';
import { ReceiptRenderer } from '@/ReceiptRenderer';

/**
 * Composition root. Every service is a singleton (one printer, one queue), and InferDI
 * disposes them in reverse creation order when the container is disposed.
 */
export const buildContainer = (cfg: Config) =>
  new Container()
    .registerValue('config', cfg)
    .registerFactory('database', (c) => new Database(c.get('config').DB_PATH))
    .registerFactory('eventBus', () => new EventBus())
    .registerFactory('printer', (c) => createPrinter(c.get('config')))
    .registerFactory('renderer', (c) => new ReceiptRenderer({ encoding: c.get('config').ENCODING }))
    .registerFactory('printQueueOptions', (c): PrintQueueOptions => {
      const { DB_PATH, JOB_MAX_WAIT, QUEUE_DASHBOARD_PORT } = c.get('config');

      return { dbPath: DB_PATH, maxWaitMs: JOB_MAX_WAIT * 1000, dashboardPort: QUEUE_DASHBOARD_PORT || null };
    })
    .registerClass('printQueue', PrintQueue, ['database', 'printer', 'eventBus', 'printQueueOptions']);

export type AppContainer = ReturnType<typeof buildContainer>;

/** Hono env for controllers: the request scope is on `c.var.di`. */
export type AppEnv = InferdiHonoEnv<AppContainer>;
