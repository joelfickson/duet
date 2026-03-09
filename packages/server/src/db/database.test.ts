import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase, resetDatabase } from "./database";
import { runMigrations } from "./migrate";

afterEach(() => {
  closeDatabase();
  resetDatabase();
});

describe("database initialization", () => {
  it("creates an in-memory database", () => {
    const db = initDatabase(":memory:");
    expect(db).toBeInstanceOf(Database);
  });

  it("enables WAL mode for file-based databases", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "duet-test-"));
    const dbPath = join(tmpDir, "test.db");
    try {
      const db = initDatabase(dbPath);
      const result = db.pragma("journal_mode") as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe("wal");
    } finally {
      closeDatabase();
      resetDatabase();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns the same instance on repeated calls", () => {
    const db1 = initDatabase(":memory:");
    const db2 = initDatabase(":memory:");
    expect(db1).toBe(db2);
  });

  it("creates data directory if it does not exist", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "duet-test-"));
    const dbPath = join(tmpDir, "subdir", "nested", "test.db");
    try {
      const db = initDatabase(dbPath);
      expect(db).toBeInstanceOf(Database);
    } finally {
      closeDatabase();
      resetDatabase();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("migrations", () => {
  it("creates _migrations table", () => {
    const db = initDatabase(":memory:");
    runMigrations(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'",
      )
      .all();
    expect(tables).toHaveLength(1);
  });

  it("applies migration files", () => {
    const db = initDatabase(":memory:");
    runMigrations(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
      )
      .all();
    expect(tables).toHaveLength(1);
  });

  it("records applied migrations", () => {
    const db = initDatabase(":memory:");
    runMigrations(db);

    const applied = db.prepare("SELECT name FROM _migrations").all() as {
      name: string;
    }[];
    expect(applied.map((r) => r.name)).toContain("001_create_sessions.sql");
  });

  it("is idempotent - running twice does not throw", () => {
    const db = initDatabase(":memory:");
    runMigrations(db);
    runMigrations(db);

    const applied = db.prepare("SELECT name FROM _migrations").all() as {
      name: string;
    }[];
    expect(
      applied.filter((r) => r.name === "001_create_sessions.sql"),
    ).toHaveLength(1);
  });

  it("creates index on created_at", () => {
    const db = initDatabase(":memory:");
    runMigrations(db);

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_created_at'",
      )
      .all();
    expect(indexes).toHaveLength(1);
  });
});
