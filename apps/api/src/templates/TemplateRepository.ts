import { asc, eq } from 'drizzle-orm';

import type { Template, TemplateVars } from '@p0s/shared';

import type { Database } from '../db/Database';
import { type TemplateRow, templates } from '../db/schema';

export type TemplateWrite = { title: string; body: string; sample: TemplateVars };

const toTemplate = (row: TemplateRow): Template => ({ ...row });

/** Templates stored in SQLite, keyed by their URL-safe name. */
export class TemplateRepository {
  constructor(private readonly db: Database) {}

  list(): Template[] {
    return this.orm.select().from(templates).orderBy(asc(templates.title)).all().map(toTemplate);
  }

  get(name: string): Template | null {
    const row = this.orm.select().from(templates).where(eq(templates.name, name)).get();

    return row ? toTemplate(row) : null;
  }

  /** Returns null if a template with that name already exists. */
  create(name: string, input: TemplateWrite): Template | null {
    const now = Date.now();
    const row = this.orm
      .insert(templates)
      .values({ name, ...input, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning()
      .get();

    return row ? toTemplate(row) : null;
  }

  update(name: string, input: TemplateWrite): Template | null {
    const row = this.orm
      .update(templates)
      .set({ ...input, updatedAt: Date.now() })
      .where(eq(templates.name, name))
      .returning()
      .get();

    return row ? toTemplate(row) : null;
  }

  delete(name: string): boolean {
    return this.orm.delete(templates).where(eq(templates.name, name)).run().changes > 0;
  }

  private get orm() {
    return this.db.orm;
  }
}
