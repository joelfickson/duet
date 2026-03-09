import type { Message } from "@duet/shared";
import { describe, expect, it } from "vitest";
import ContextService from "./context";

function makeMessage(
  overrides: Partial<Message> & { content: string; role: Message["role"] },
  index = 0,
): Message {
  return {
    id: `msg-${index}`,
    sessionId: "session-1",
    senderId: overrides.role === "assistant" ? "ai" : `user-${index}`,
    senderName: overrides.role === "assistant" ? "AI" : `User ${index}`,
    createdAt: new Date(2024, 0, 1, 0, 0, index).toISOString(),
    ...overrides,
  };
}

describe("ContextService", () => {
  const service = new ContextService();

  it("returns empty array for no messages", () => {
    expect(service.buildContext([])).toEqual([]);
  });

  it("maps user messages with sender name prefix", () => {
    const messages: Message[] = [
      makeMessage({ content: "hello", role: "user" }, 0),
    ];
    const result = service.buildContext(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("User 0: hello");
  });

  it("maps assistant messages without prefix", () => {
    const messages: Message[] = [
      makeMessage({ content: "hi there", role: "assistant" }, 0),
    ];
    const result = service.buildContext(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
    expect(result[0].content).toBe("hi there");
  });

  it("sorts messages chronologically", () => {
    const messages: Message[] = [
      makeMessage({ content: "second", role: "user" }, 1),
      makeMessage({ content: "first", role: "user" }, 0),
    ];
    const result = service.buildContext(messages);
    expect(result[0].content).toContain("first");
    expect(result[1].content).toContain("second");
  });

  it("truncates oldest messages when exceeding token limit", () => {
    const long = "x".repeat(400);
    const messages: Message[] = [
      makeMessage({ content: long, role: "user" }, 0),
      makeMessage({ content: long, role: "user" }, 1),
      makeMessage({ content: "recent", role: "user" }, 2),
    ];
    const result = service.buildContext(messages, 200);
    expect(result.length).toBeLessThan(3);
    expect(result[result.length - 1].content).toContain("recent");
  });
});
