import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Creates a D1Database-compatible wrapper around Node's SQLite engine.
 * Applies versioned SQL migrations automatically on startup if tables are not present.
 */
export function createLocalD1(sqliteDbPath?: string): any {
  // If a path is provided, ensure parent directory exists
  if (sqliteDbPath && sqliteDbPath !== ':memory:') {
    const dir = path.dirname(sqliteDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(sqliteDbPath || ':memory:');

  // Auto-apply migrations if users table does not exist
  try {
    const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!check) {
      const migrationsDir = path.resolve(process.cwd(), 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs
          .readdirSync(migrationsDir)
          .filter((f: string) => f.endsWith('.sql'))
          .sort();

        for (const file of migrationFiles) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          db.exec(sql);
        }
      }
    }
  } catch (err) {
    console.warn('[D1 Adapter] Migration auto-check warning:', err);
  }

  return {
    prepare(query: string) {
      let bindings: any[] = [];
      return {
        bind(...args: any[]) {
          bindings = args;
          return this;
        },
        async first<T = unknown>(colName?: string): Promise<T | null> {
          const stmt = db.prepare(query);
          const row: any = stmt.get(...bindings);
          if (!row) return null;
          if (colName) return row[colName];
          return row as T;
        },
        async all<T = unknown>(): Promise<{ results: T[]; meta: any }> {
          const stmt = db.prepare(query);
          const results = stmt.all(...bindings) as T[];
          return { results, meta: { changes: 0 } };
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const stmt = db.prepare(query);
          const result = stmt.run(...bindings);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
      };
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    async batch(statements: any[]) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };
}
