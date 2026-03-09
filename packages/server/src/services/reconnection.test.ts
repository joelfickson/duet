import type { Message, Participant } from "@duet/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReconnectionService from "./reconnection";

function makeParticipant(id = "p-1"): Participant {
  return { id, name: `User ${id}`, connectedAt: new Date().toISOString() };
}

function makeMessage(sessionId = "sess-1", content = "hello"): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    sessionId,
    senderId: "sender-1",
    senderName: "Sender",
    content,
    role: "user",
    createdAt: new Date().toISOString(),
  };
}

describe("ReconnectionService", () => {
  let service: ReconnectionService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ReconnectionService();
    service.setGracePeriod(60_000);
  });

  afterEach(() => {
    service.clearAll();
    vi.useRealTimers();
  });

  describe("stash", () => {
    it("stashes a participant for later reconnection", () => {
      const p = makeParticipant("p-1");
      service.stash("sess-1", p);

      const result = service.tryReconnect("sess-1", "p-1");
      expect(result).not.toBeNull();
      expect(result?.participant).toEqual(p);
      expect(result?.missedMessages).toEqual([]);
    });

    it("replaces an existing stash for the same participant", () => {
      const p1 = makeParticipant("p-1");
      service.stash("sess-1", p1);

      const p2 = { ...p1, name: "Updated" };
      service.stash("sess-1", p2);

      const result = service.tryReconnect("sess-1", "p-1");
      expect(result?.participant.name).toBe("Updated");
    });

    it("expires after grace period", () => {
      service.stash("sess-1", makeParticipant("p-1"));
      vi.advanceTimersByTime(60_000);

      expect(service.tryReconnect("sess-1", "p-1")).toBeNull();
    });

    it("respects custom grace period", () => {
      service.setGracePeriod(5000);
      service.stash("sess-1", makeParticipant("p-1"));

      vi.advanceTimersByTime(4999);
      expect(service.tryReconnect("sess-1", "p-1")).not.toBeNull();
    });

    it("custom grace period causes expiry at the set time", () => {
      service.setGracePeriod(5000);
      service.stash("sess-1", makeParticipant("p-1"));

      vi.advanceTimersByTime(5000);
      expect(service.tryReconnect("sess-1", "p-1")).toBeNull();
    });
  });

  describe("bufferMessage", () => {
    it("buffers messages for disconnected participants in the session", () => {
      service.stash("sess-1", makeParticipant("p-1"));

      const msg = makeMessage("sess-1", "missed this");
      service.bufferMessage("sess-1", msg);

      const result = service.tryReconnect("sess-1", "p-1");
      expect(result?.missedMessages).toHaveLength(1);
      expect(result?.missedMessages[0].content).toBe("missed this");
    });

    it("buffers multiple messages in order", () => {
      service.stash("sess-1", makeParticipant("p-1"));

      service.bufferMessage("sess-1", makeMessage("sess-1", "first"));
      service.bufferMessage("sess-1", makeMessage("sess-1", "second"));
      service.bufferMessage("sess-1", makeMessage("sess-1", "third"));

      const result = service.tryReconnect("sess-1", "p-1");
      expect(result?.missedMessages.map((m) => m.content)).toEqual([
        "first",
        "second",
        "third",
      ]);
    });

    it("does not buffer messages for a different session", () => {
      service.stash("sess-1", makeParticipant("p-1"));
      service.bufferMessage("sess-2", makeMessage("sess-2", "other session"));

      const result = service.tryReconnect("sess-1", "p-1");
      expect(result?.missedMessages).toHaveLength(0);
    });

    it("buffers to multiple disconnected participants in the same session", () => {
      service.stash("sess-1", makeParticipant("p-1"));
      service.stash("sess-1", makeParticipant("p-2"));

      service.bufferMessage("sess-1", makeMessage("sess-1", "broadcast"));

      const r1 = service.tryReconnect("sess-1", "p-1");
      const r2 = service.tryReconnect("sess-1", "p-2");
      expect(r1?.missedMessages).toHaveLength(1);
      expect(r2?.missedMessages).toHaveLength(1);
    });
  });

  describe("tryReconnect", () => {
    it("returns null for unknown participant", () => {
      expect(service.tryReconnect("sess-1", "unknown")).toBeNull();
    });

    it("removes entry after successful reconnect", () => {
      service.stash("sess-1", makeParticipant("p-1"));
      service.tryReconnect("sess-1", "p-1");

      expect(service.tryReconnect("sess-1", "p-1")).toBeNull();
    });
  });

  describe("clearAll", () => {
    it("removes all stashed entries", () => {
      service.stash("sess-1", makeParticipant("p-1"));
      service.stash("sess-2", makeParticipant("p-2"));

      service.clearAll();

      expect(service.tryReconnect("sess-1", "p-1")).toBeNull();
      expect(service.tryReconnect("sess-2", "p-2")).toBeNull();
    });
  });
});
