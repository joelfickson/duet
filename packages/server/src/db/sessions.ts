import type Database from "better-sqlite3";

export interface SessionRow {
  id: string;
  title: string | null;
  created_at: string;
  closed_at: string | null;
}

export function createSessionRow(
  db: Database.Database,
  id: string,
  title: string | null,
  createdAt: string,
): SessionRow {
  db.prepare(
    "INSERT INTO sessions (id, title, created_at) VALUES (?, ?, ?)",
  ).run(id, title, createdAt);

  return { id, title, created_at: createdAt, closed_at: null };
}

export function closeSessionRow(
  db: Database.Database,
  id: string,
): SessionRow | undefined {
  const closedAt = new Date().toISOString();
  const result = db
    .prepare(
      "UPDATE sessions SET closed_at = ? WHERE id = ? AND closed_at IS NULL",
    )
    .run(closedAt, id);

  if (result.changes === 0) return undefined;

  return getSessionRow(db, id);
}

export function getSessionRow(
  db: Database.Database,
  id: string,
): SessionRow | undefined {
  return db
    .prepare(
      "SELECT id, title, created_at, closed_at FROM sessions WHERE id = ?",
    )
    .get(id) as SessionRow | undefined;
}

export function listSessionRows(
  db: Database.Database,
  limit = 50,
  offset = 0,
): SessionRow[] {
  return db
    .prepare(
      "SELECT id, title, created_at, closed_at FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(limit, offset) as SessionRow[];
}
