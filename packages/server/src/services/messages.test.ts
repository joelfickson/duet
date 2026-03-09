import { describe, expect, it } from "vitest";
import MessageService from "./messages";

describe("MessageService", () => {
  const service = new MessageService();

  describe("validateContent", () => {
    it("returns true for non-empty string", () => {
      expect(service.validateContent("hello")).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(service.validateContent("")).toBe(false);
    });

    it("returns false for whitespace-only string", () => {
      expect(service.validateContent("   ")).toBe(false);
      expect(service.validateContent("\t\n")).toBe(false);
    });

    it("returns false for non-string types", () => {
      expect(service.validateContent(null)).toBe(false);
      expect(service.validateContent(undefined)).toBe(false);
      expect(service.validateContent(42)).toBe(false);
      expect(service.validateContent({})).toBe(false);
      expect(service.validateContent([])).toBe(false);
      expect(service.validateContent(true)).toBe(false);
    });

    it("returns true for string with leading/trailing whitespace around content", () => {
      expect(service.validateContent("  hi  ")).toBe(true);
    });
  });

  describe("create", () => {
    it("returns a message with correct fields", () => {
      const msg = service.create("sess-1", "sender-1", "Alice", "Hello world");

      expect(msg.sessionId).toBe("sess-1");
      expect(msg.senderId).toBe("sender-1");
      expect(msg.senderName).toBe("Alice");
      expect(msg.content).toBe("Hello world");
      expect(msg.role).toBe("user");
      expect(msg.id).toBeDefined();
      expect(msg.createdAt).toBeDefined();
    });

    it("trims content whitespace", () => {
      const msg = service.create("sess-1", "sender-1", "Alice", "  padded  ");
      expect(msg.content).toBe("padded");
    });

    it("generates unique IDs across calls", () => {
      const m1 = service.create("s", "p", "n", "a");
      const m2 = service.create("s", "p", "n", "b");
      expect(m1.id).not.toBe(m2.id);
    });

    it("sets createdAt to a valid ISO timestamp", () => {
      const msg = service.create("s", "p", "n", "content");
      const parsed = new Date(msg.createdAt);
      expect(parsed.toISOString()).toBe(msg.createdAt);
    });
  });
});
