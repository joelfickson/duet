import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const DEFAULT_PATH = "./data/duet.db";

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;
  return initDatabase();
}

export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath ?? process.env.DATABASE_PATH ?? DEFAULT_PATH;

  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function resetDatabase(): void {
  db = null;
}
