import { beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import {
  addConnection,
  clearAllConnections,
  getConnection,
  getConnectionsForSession,
  getSessionForConnection,
  mapConnectionToSession,
  removeConnection,
  unmapConnectionFromSession,
} from "./connections";

function fakeSocket(): WebSocket {
  return { readyState: 1, OPEN: 1 } as unknown as WebSocket;
}

describe("connections", () => {
  beforeEach(() => {
    clearAllConnections();
  });

  it("adds and retrieves a connection", () => {
    const conn = addConnection(fakeSocket());
    expect(getConnection(conn.id)).toBe(conn);
    expect(conn.sessionId).toBeNull();
    expect(conn.participantId).toBeNull();
  });

  it("removes a connection", () => {
    const conn = addConnection(fakeSocket());
    removeConnection(conn.id);
    expect(getConnection(conn.id)).toBeUndefined();
  });

  it("maps connection to session bidirectionally", () => {
    const conn = addConnection(fakeSocket());
    mapConnectionToSession(conn.id, "sess-1", "part-1");

    expect(conn.sessionId).toBe("sess-1");
    expect(conn.participantId).toBe("part-1");
    expect(getSessionForConnection(conn.id)).toBe("sess-1");
    expect(getConnectionsForSession("sess-1")).toHaveLength(1);
    expect(getConnectionsForSession("sess-1")[0].id).toBe(conn.id);
  });

  it("supports multiple connections per session", () => {
    const c1 = addConnection(fakeSocket());
    const c2 = addConnection(fakeSocket());
    const c3 = addConnection(fakeSocket());

    mapConnectionToSession(c1.id, "sess-1", "p1");
    mapConnectionToSession(c2.id, "sess-1", "p2");
    mapConnectionToSession(c3.id, "sess-1", "p3");

    const conns = getConnectionsForSession("sess-1");
    expect(conns).toHaveLength(3);
    const ids = conns.map((c) => c.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);
    expect(ids).toContain(c3.id);
  });

  it("unmaps connection from session", () => {
    const conn = addConnection(fakeSocket());
    mapConnectionToSession(conn.id, "sess-1", "p1");
    unmapConnectionFromSession(conn.id);

    expect(conn.sessionId).toBeNull();
    expect(conn.participantId).toBeNull();
    expect(getSessionForConnection(conn.id)).toBeNull();
    expect(getConnectionsForSession("sess-1")).toHaveLength(0);
  });

  it("cleans up session set when last connection is removed", () => {
    const c1 = addConnection(fakeSocket());
    const c2 = addConnection(fakeSocket());

    mapConnectionToSession(c1.id, "sess-1", "p1");
    mapConnectionToSession(c2.id, "sess-1", "p2");

    unmapConnectionFromSession(c1.id);
    expect(getConnectionsForSession("sess-1")).toHaveLength(1);

    unmapConnectionFromSession(c2.id);
    expect(getConnectionsForSession("sess-1")).toHaveLength(0);
  });

  it("removeConnection also cleans up session mapping", () => {
    const conn = addConnection(fakeSocket());
    mapConnectionToSession(conn.id, "sess-1", "p1");
    removeConnection(conn.id);

    expect(getSessionForConnection(conn.id)).toBeNull();
    expect(getConnectionsForSession("sess-1")).toHaveLength(0);
  });

  it("returns empty array for unknown session", () => {
    expect(getConnectionsForSession("nonexistent")).toEqual([]);
  });

  it("returns null for unknown connection session lookup", () => {
    expect(getSessionForConnection("nonexistent")).toBeNull();
  });
});
