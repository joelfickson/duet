import { beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import ConnectionService from "./connections";

function fakeSocket(): WebSocket {
  return { readyState: 1, OPEN: 1 } as unknown as WebSocket;
}

describe("ConnectionService", () => {
  let service: ConnectionService;

  beforeEach(() => {
    service = new ConnectionService();
  });

  it("adds and retrieves a connection", () => {
    const conn = service.add(fakeSocket());
    expect(service.get(conn.id)).toBe(conn);
    expect(conn.sessionId).toBeNull();
    expect(conn.participantId).toBeNull();
  });

  it("removes a connection", () => {
    const conn = service.add(fakeSocket());
    service.remove(conn.id);
    expect(service.get(conn.id)).toBeUndefined();
  });

  it("maps connection to session bidirectionally", () => {
    const conn = service.add(fakeSocket());
    service.mapToSession(conn.id, "sess-1", "part-1");

    expect(conn.sessionId).toBe("sess-1");
    expect(conn.participantId).toBe("part-1");
    expect(service.getSessionForConnection(conn.id)).toBe("sess-1");
    expect(service.getForSession("sess-1")).toHaveLength(1);
    expect(service.getForSession("sess-1")[0].id).toBe(conn.id);
  });

  it("supports multiple connections per session", () => {
    const c1 = service.add(fakeSocket());
    const c2 = service.add(fakeSocket());
    const c3 = service.add(fakeSocket());

    service.mapToSession(c1.id, "sess-1", "p1");
    service.mapToSession(c2.id, "sess-1", "p2");
    service.mapToSession(c3.id, "sess-1", "p3");

    const conns = service.getForSession("sess-1");
    expect(conns).toHaveLength(3);
    const ids = conns.map((c) => c.id);
    expect(ids).toContain(c1.id);
    expect(ids).toContain(c2.id);
    expect(ids).toContain(c3.id);
  });

  it("unmaps connection from session", () => {
    const conn = service.add(fakeSocket());
    service.mapToSession(conn.id, "sess-1", "p1");
    service.unmapFromSession(conn.id);

    expect(conn.sessionId).toBeNull();
    expect(conn.participantId).toBeNull();
    expect(service.getSessionForConnection(conn.id)).toBeNull();
    expect(service.getForSession("sess-1")).toHaveLength(0);
  });

  it("cleans up session set when last connection is removed", () => {
    const c1 = service.add(fakeSocket());
    const c2 = service.add(fakeSocket());

    service.mapToSession(c1.id, "sess-1", "p1");
    service.mapToSession(c2.id, "sess-1", "p2");

    service.unmapFromSession(c1.id);
    expect(service.getForSession("sess-1")).toHaveLength(1);

    service.unmapFromSession(c2.id);
    expect(service.getForSession("sess-1")).toHaveLength(0);
  });

  it("remove also cleans up session mapping", () => {
    const conn = service.add(fakeSocket());
    service.mapToSession(conn.id, "sess-1", "p1");
    service.remove(conn.id);

    expect(service.getSessionForConnection(conn.id)).toBeNull();
    expect(service.getForSession("sess-1")).toHaveLength(0);
  });

  it("returns empty array for unknown session", () => {
    expect(service.getForSession("nonexistent")).toEqual([]);
  });

  it("returns null for unknown connection session lookup", () => {
    expect(service.getSessionForConnection("nonexistent")).toBeNull();
  });
});
