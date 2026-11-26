import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import Sqlite from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '@/db/schema';

export type Orm = BetterSQLite3Database<typeof schema>;

/** The app's single SQLite file: Drizzle for our tables, and the raw handle shared with Workmatic. */
export class Database {
  readonly sqlite: Sqlite.Database;
  readonly orm: Orm;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.sqlite = new Sqlite(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('busy_timeout = 5000');

    this.orm = drizzle(this.sqlite, { schema });
    migrate(this.orm, { migrationsFolder: join(import.meta.dirname, '../../drizzle') });
  }

  close() {
    this.sqlite.close();
  }

  [Symbol.dispose]() {
    this.close();
  }
}

export { schema };
