import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, initDatabase, resetDatabase } from "./database";
import { runMigrations } from "./migrate";
import {
  closeSessionRow,
  createSessionRow,
  getSessionRow,
  listSessionRows,
} from "./sessions";

let db: Database.Database;

beforeEach(() => {
  db = initDatabase(":memory:");
  runMigrations(db);
});

afterEach(() => {
  closeDatabase();
  resetDatabase();
});

describe("createSessionRow", () => {
  it("inserts a session and returns it", () => {
    const now = new Date().toISOString();
    const row = createSessionRow(db, "s1", "Test Session", now);

    expect(row.id).toBe("s1");
    expect(row.title).toBe("Test Session");
    expect(row.created_at).toBe(now);
    expect(row.closed_at).toBeNull();
  });

  it("allows null title", () => {
    const row = createSessionRow(db, "s2", null, new Date().toISOString());
    expect(row.title).toBeNull();
  });
});

describe("getSessionRow", () => {
  it("returns the session by id", () => {
    const now = new Date().toISOString();
    createSessionRow(db, "s1", "My Session", now);

    const row = getSessionRow(db, "s1");
    expect(row).toBeDefined();
    expect(row?.id).toBe("s1");
    expect(row?.title).toBe("My Session");
  });

  it("returns undefined for nonexistent id", () => {
    const row = getSessionRow(db, "nonexistent");
    expect(row).toBeUndefined();
  });
});

describe("closeSessionRow", () => {
  it("sets closed_at on an open session", () => {
    createSessionRow(db, "s1", "Test", new Date().toISOString());

    const closed = closeSessionRow(db, "s1");
    expect(closed).toBeDefined();
    expect(closed?.closed_at).not.toBeNull();
  });

  it("returns undefined when session does not exist", () => {
    const result = closeSessionRow(db, "nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns undefined when session is already closed", () => {
    createSessionRow(db, "s1", "Test", new Date().toISOString());
    closeSessionRow(db, "s1");

    const result = closeSessionRow(db, "s1");
    expect(result).toBeUndefined();
  });
});

describe("listSessionRows", () => {
  it("returns sessions in reverse chronological order", () => {
    createSessionRow(db, "s1", "First", "2024-01-01T00:00:00.000Z");
    createSessionRow(db, "s2", "Second", "2024-01-02T00:00:00.000Z");
    createSessionRow(db, "s3", "Third", "2024-01-03T00:00:00.000Z");

    const rows = listSessionRows(db);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe("s3");
    expect(rows[1].id).toBe("s2");
    expect(rows[2].id).toBe("s1");
  });

  it("respects limit parameter", () => {
    createSessionRow(db, "s1", "First", "2024-01-01T00:00:00.000Z");
    createSessionRow(db, "s2", "Second", "2024-01-02T00:00:00.000Z");
    createSessionRow(db, "s3", "Third", "2024-01-03T00:00:00.000Z");

    const rows = listSessionRows(db, 2);
    expect(rows).toHaveLength(2);
  });

  it("respects offset parameter", () => {
    createSessionRow(db, "s1", "First", "2024-01-01T00:00:00.000Z");
    createSessionRow(db, "s2", "Second", "2024-01-02T00:00:00.000Z");
    createSessionRow(db, "s3", "Third", "2024-01-03T00:00:00.000Z");

    const rows = listSessionRows(db, 50, 1);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("s2");
  });

  it("returns empty array when no sessions exist", () => {
    const rows = listSessionRows(db);
    expect(rows).toEqual([]);
  });
});
