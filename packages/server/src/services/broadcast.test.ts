import type { Participant } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BroadcastService from "./broadcast";
import type ConnectionService from "./connections";
import type { Connection } from "./connections";
import type SessionService from "./sessions";

function fakeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: overrides.id ?? "conn-1",
    socket: {
      readyState: 1,
      OPEN: 1,
      send: vi.fn(),
    } as unknown as Connection["socket"],
    connectedAt: new Date().toISOString(),
    sessionId: "sess-1",
    participantId: "p-1",
    ...overrides,
  };
}

describe("BroadcastService", () => {
  let mockConnections: { getForSession: ReturnType<typeof vi.fn> };
  let mockSessions: { getParticipants: ReturnType<typeof vi.fn> };
  let service: BroadcastService;

  beforeEach(() => {
    mockConnections = { getForSession: vi.fn(() => []) };
    mockSessions = { getParticipants: vi.fn(() => []) };
    service = new BroadcastService(
      mockConnections as unknown as ConnectionService,
      mockSessions as unknown as SessionService,
    );
  });

  describe("toSession", () => {
    it("sends serialized payload to all connections in session", () => {
      const c1 = fakeConnection({ id: "c1" });
      const c2 = fakeConnection({ id: "c2" });
      mockConnections.getForSession.mockReturnValue([c1, c2]);

      const payload = {
        type: WsEvent.Typing,
        sessionId: "sess-1",
        participantId: "p-1",
        isTyping: true,
      } as const;
      service.toSession("sess-1", payload);

      const expected = JSON.stringify(payload);
      expect(c1.socket.send).toHaveBeenCalledWith(expected);
      expect(c2.socket.send).toHaveBeenCalledWith(expected);
    });

    it("excludes connection matching excludeConnectionId", () => {
      const c1 = fakeConnection({ id: "c1" });
      const c2 = fakeConnection({ id: "c2" });
      mockConnections.getForSession.mockReturnValue([c1, c2]);

      const payload = {
        type: WsEvent.Typing,
        sessionId: "sess-1",
        participantId: "p-1",
        isTyping: true,
      } as const;
      service.toSession("sess-1", payload, "c1");

      expect(c1.socket.send).not.toHaveBeenCalled();
      expect(c2.socket.send).toHaveBeenCalledWith(JSON.stringify(payload));
    });

    it("skips connections whose socket is not OPEN", () => {
      const c1 = fakeConnection({ id: "c1" });
      (c1.socket as unknown as { readyState: number }).readyState = 3;
      mockConnections.getForSession.mockReturnValue([c1]);

      service.toSession("sess-1", {
        type: WsEvent.Typing,
        sessionId: "sess-1",
        participantId: "p-1",
        isTyping: true,
      });

      expect(c1.socket.send).not.toHaveBeenCalled();
    });

    it("handles empty connection list gracefully", () => {
      mockConnections.getForSession.mockReturnValue([]);
      expect(() =>
        service.toSession("sess-1", {
          type: WsEvent.Typing,
          sessionId: "sess-1",
          participantId: "p-1",
          isTyping: true,
        }),
      ).not.toThrow();
    });
  });

  describe("presence", () => {
    it("broadcasts presence payload with participants to session", () => {
      const participants: Participant[] = [
        { id: "p-1", name: "Alice", connectedAt: new Date().toISOString() },
      ];
      mockSessions.getParticipants.mockReturnValue(participants);

      const c1 = fakeConnection({ id: "c1" });
      mockConnections.getForSession.mockReturnValue([c1]);

      service.presence("sess-1");

      expect(mockSessions.getParticipants).toHaveBeenCalledWith("sess-1");
      const sent = JSON.parse(
        (c1.socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0],
      );
      expect(sent).toEqual({
        type: WsEvent.Presence,
        sessionId: "sess-1",
        participants,
      });
    });

    it("broadcasts empty participants when none exist", () => {
      mockSessions.getParticipants.mockReturnValue([]);
      const c1 = fakeConnection({ id: "c1" });
      mockConnections.getForSession.mockReturnValue([c1]);

      service.presence("sess-1");

      const sent = JSON.parse(
        (c1.socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0],
      );
      expect(sent.participants).toEqual([]);
    });
  });
});
