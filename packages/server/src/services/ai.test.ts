import { describe, expect, it } from "vitest";
import AiService from "./ai";
import type BroadcastService from "./broadcast";
import type ContextService from "./context";
import type RetryService from "./retry";
import type SessionService from "./sessions";
import type SystemPromptService from "./system-prompt";

function createAiService(): AiService {
  return new AiService(
    {} as BroadcastService,
    {} as ContextService,
    {} as SessionService,
    {} as SystemPromptService,
    {} as RetryService,
  );
}

describe("AiService config", () => {
  it("returns null when no key is set and no env var", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const service = createAiService();
    const key = service.getSessionApiKey("no-key-session");
    expect(key).toBeNull();
    if (original) process.env.ANTHROPIC_API_KEY = original;
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
  });

  it("stores and retrieves a session key", () => {
    const service = createAiService();
    service.setSessionConfig("s1", "sk-test-123");
    expect(service.getSessionApiKey("s1")).toBe("sk-test-123");
  });

  it("defaults provider to anthropic", () => {
    const service = createAiService();
    service.setSessionConfig("s3", "sk-test");
    expect(service.getSessionProvider("s3")).toBe("anthropic");
  });

  it("stores provider preference", () => {
    const service = createAiService();
    service.setSessionConfig("s4", "gemini-key", "gemini");
    expect(service.getSessionProvider("s4")).toBe("gemini");
    expect(service.getSessionApiKey("s4")).toBe("gemini-key");
  });

  it("clears session state", () => {
    const service = createAiService();
    service.setSessionConfig("s2", "sk-test-456");
    service.addMessageToHistory("s2", {
      id: "m1",
      sessionId: "s2",
      senderId: "u1",
      senderName: "User",
      content: "hello",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    service.clearSessionState("s2");
    expect(service.getMessageHistory("s2")).toEqual([]);
  });
});

describe("AiService message history", () => {
  it("starts empty", () => {
    const service = createAiService();
    expect(service.getMessageHistory("empty-session")).toEqual([]);
  });

  it("accumulates messages", () => {
    const service = createAiService();
    const sessionId = "hist-test";
    service.addMessageToHistory(sessionId, {
      id: "m1",
      sessionId,
      senderId: "u1",
      senderName: "User",
      content: "first",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    service.addMessageToHistory(sessionId, {
      id: "m2",
      sessionId,
      senderId: "u2",
      senderName: "User 2",
      content: "second",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    const history = service.getMessageHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("first");
    expect(history[1].content).toBe("second");
  });
});
