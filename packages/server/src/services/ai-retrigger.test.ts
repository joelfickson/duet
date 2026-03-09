import type { Message } from "@duet/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers", () => {
  const LlmError = class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  };
  return {
    LlmError,
    getProvider: vi.fn(() => ({
      stream: vi.fn(async function* () {
        yield "response";
      }),
    })),
  };
});

import AiService from "./ai";
import type BroadcastService from "./broadcast";
import ContextService from "./context";
import RetryService from "./retry";
import SessionService from "./sessions";
import SystemPromptService from "./system-prompt";

function makeMessage(sessionId: string, content: string): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    sessionId,
    senderId: "u1",
    senderName: "User",
    content,
    role: "user",
    createdAt: new Date().toISOString(),
  };
}

describe("AiService re-trigger", () => {
  const sessionId = "retrigger-test";
  const broadcastMock = { toSession: vi.fn() };

  function createService(): AiService {
    return new AiService(
      broadcastMock as unknown as BroadcastService,
      new ContextService(),
      new SessionService(),
      new SystemPromptService(),
      new RetryService(),
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
    broadcastMock.toSession.mockClear();
  });

  it("re-triggers when new user messages arrive during streaming", async () => {
    const { getProvider } = await import("./providers");

    const service = createService();
    let streamCallCount = 0;

    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      stream: vi.fn(async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          service.addMessageToHistory(
            sessionId,
            makeMessage(sessionId, "concurrent"),
          );
        }
        yield `response-${streamCallCount}`;
      }),
    });

    service.setSessionConfig(sessionId, "test-key", "anthropic");
    service.addMessageToHistory(sessionId, makeMessage(sessionId, "first"));

    await service.triggerAiResponse(sessionId);

    expect(streamCallCount).toBe(2);

    const doneEvents = broadcastMock.toSession.mock.calls.filter(
      (call: unknown[]) => (call[1] as { type: string }).type === "ai-done",
    );
    expect(doneEvents).toHaveLength(2);
  });

  it("does not re-trigger when no new user messages arrive", async () => {
    const { getProvider } = await import("./providers");

    const service = createService();
    let streamCallCount = 0;

    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      stream: vi.fn(async function* () {
        streamCallCount++;
        yield "response";
      }),
    });

    service.setSessionConfig(sessionId, "test-key", "anthropic");
    service.addMessageToHistory(sessionId, makeMessage(sessionId, "hello"));

    await service.triggerAiResponse(sessionId);

    expect(streamCallCount).toBe(1);
  });

  it("does not re-trigger for assistant-only messages added during stream", async () => {
    const { getProvider } = await import("./providers");

    const service = createService();
    let streamCallCount = 0;

    (getProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      stream: vi.fn(async function* () {
        streamCallCount++;
        if (streamCallCount === 1) {
          service.addMessageToHistory(sessionId, {
            id: "ai-msg",
            sessionId,
            senderId: "ai",
            senderName: "AI",
            content: "ai response",
            role: "assistant",
            createdAt: new Date().toISOString(),
          });
        }
        yield "response";
      }),
    });

    service.setSessionConfig(sessionId, "test-key", "anthropic");
    service.addMessageToHistory(sessionId, makeMessage(sessionId, "hello"));

    await service.triggerAiResponse(sessionId);

    expect(streamCallCount).toBe(1);
  });
});
