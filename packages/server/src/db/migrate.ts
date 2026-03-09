import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

export function runMigrations(
  db: Database.Database,
  migrationsDir?: string,
): void {
  const dir = migrationsDir ?? new URL("migrations", import.meta.url).pathname;

  db.exec(MIGRATIONS_TABLE);

  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(dir, file), "utf-8");

    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    })();
  }
}
