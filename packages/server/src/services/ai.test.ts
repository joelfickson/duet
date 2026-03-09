import { describe, expect, it } from "vitest";
import {
  addMessageToHistory,
  clearSessionState,
  getMessageHistory,
  getSessionApiKey,
  getSessionProvider,
  setSessionConfig,
} from "./ai";

describe("session config", () => {
  it("returns null when no key is set and no env var", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const key = getSessionApiKey("no-key-session");
    expect(key).toBeNull();
    if (original) process.env.ANTHROPIC_API_KEY = original;
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
  });

  it("stores and retrieves a session key", () => {
    setSessionConfig("s1", "sk-test-123");
    expect(getSessionApiKey("s1")).toBe("sk-test-123");
    clearSessionState("s1");
  });

  it("defaults provider to anthropic", () => {
    setSessionConfig("s3", "sk-test");
    expect(getSessionProvider("s3")).toBe("anthropic");
    clearSessionState("s3");
  });

  it("stores provider preference", () => {
    setSessionConfig("s4", "gemini-key", "gemini");
    expect(getSessionProvider("s4")).toBe("gemini");
    expect(getSessionApiKey("s4")).toBe("gemini-key");
    clearSessionState("s4");
  });

  it("clears session state", () => {
    setSessionConfig("s2", "sk-test-456");
    addMessageToHistory("s2", {
      id: "m1",
      sessionId: "s2",
      senderId: "u1",
      senderName: "User",
      content: "hello",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    clearSessionState("s2");
    expect(getMessageHistory("s2")).toEqual([]);
  });
});

describe("message history", () => {
  it("starts empty", () => {
    expect(getMessageHistory("empty-session")).toEqual([]);
  });

  it("accumulates messages", () => {
    const sessionId = "hist-test";
    addMessageToHistory(sessionId, {
      id: "m1",
      sessionId,
      senderId: "u1",
      senderName: "User",
      content: "first",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    addMessageToHistory(sessionId, {
      id: "m2",
      sessionId,
      senderId: "u2",
      senderName: "User 2",
      content: "second",
      role: "user",
      createdAt: new Date().toISOString(),
    });
    const history = getMessageHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("first");
    expect(history[1].content).toBe("second");
    clearSessionState(sessionId);
  });
});
