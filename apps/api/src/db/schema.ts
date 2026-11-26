import { blob, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { JobKind, JobStatus } from '@p0s/shared';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  kind: text('kind').$type<JobKind>().notNull(),
  status: text('status').$type<JobStatus>().notNull(),
  /** ReceiptLine / text source, for display and template re-render */
  source: text('source'),
  /** Processed PNG for image jobs */
  image: blob('image', { mode: 'buffer' }),
  template: text('template'),
  vars: text('vars', { mode: 'json' }).$type<Record<string, unknown>>(),
  /** Rendered ESC/POS bytes — what was (or will be) sent. Reprints reuse this. */
  payload: blob('payload', { mode: 'buffer' }).notNull(),
  /** Sidequest job id, for cancellation */
  queueJobId: integer('queue_job_id'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type JobRow = typeof jobs.$inferSelect;

export const templates = sqliteTable('templates', {
  name: text('name').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sample: text('sample', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type TemplateRow = typeof templates.$inferSelect;
