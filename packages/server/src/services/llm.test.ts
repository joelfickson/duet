import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { LlmError, streamCompletion } from "./llm";

vi.mock("@anthropic-ai/sdk", () => {
  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  }

  class MockAPIConnectionTimeoutError extends Error {
    constructor() {
      super("Request timed out");
      this.name = "APIConnectionTimeoutError";
    }
  }

  const MockAnthropic = vi.fn() as ReturnType<typeof vi.fn> & {
    APIError: typeof MockAPIError;
    APIConnectionTimeoutError: typeof MockAPIConnectionTimeoutError;
  };
  MockAnthropic.APIError = MockAPIError;
  MockAnthropic.APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
  return { default: MockAnthropic };
});

function createMockStream(tokens: string[]) {
  const events = tokens.map((text) => ({
    type: "content_block_delta" as const,
    delta: { type: "text_delta" as const, text },
  }));

  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function setupMock(
  streamReturn: ReturnType<typeof createMockStream>,
): ReturnType<typeof vi.fn> {
  const mockStream = vi.fn().mockReturnValue(streamReturn);
  vi.mocked(Anthropic).mockImplementation(function (this: unknown) {
    Object.assign(this as Record<string, unknown>, {
      messages: { stream: mockStream },
    });
  } as unknown as () => Anthropic);
  return mockStream;
}

function setupThrowingMock(error: Error) {
  const mockStream = vi.fn().mockImplementation(() => {
    throw error;
  });
  vi.mocked(Anthropic).mockImplementation(function (this: unknown) {
    Object.assign(this as Record<string, unknown>, {
      messages: { stream: mockStream },
    });
  } as unknown as () => Anthropic);
}

function setupStreamErrorMock(firstToken: string, error: Error) {
  vi.mocked(Anthropic).mockImplementation(function (this: unknown) {
    Object.assign(this as Record<string, unknown>, {
      messages: {
        stream: () => ({
          async *[Symbol.asyncIterator]() {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: firstToken },
            };
            throw error;
          },
        }),
      },
    });
  } as unknown as () => Anthropic);
}

async function collectTokens(
  params: Parameters<typeof streamCompletion>[0],
): Promise<string[]> {
  const tokens: string[] = [];
  for await (const token of streamCompletion(params)) {
    tokens.push(token);
  }
  return tokens;
}

const baseParams = {
  messages: [{ role: "user" as const, content: "Hello" }],
  apiKey: "test-key",
};

describe("streamCompletion", () => {
  it("yields tokens from a streamed response", async () => {
    setupMock(createMockStream(["Hello", " world", "!"]));

    const tokens = await collectTokens(baseParams);
    expect(tokens).toEqual(["Hello", " world", "!"]);
  });

  it("uses the default model when none is provided", async () => {
    const mockStream = setupMock(createMockStream(["ok"]));

    await collectTokens(baseParams);

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-sonnet-4-20250514" }),
    );
  });

  it("passes a custom model when provided", async () => {
    const mockStream = setupMock(createMockStream(["ok"]));

    await collectTokens({ ...baseParams, model: "claude-opus-4-20250514" });

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-20250514" }),
    );
  });

  it("passes the system prompt when provided", async () => {
    const mockStream = setupMock(createMockStream(["ok"]));

    await collectTokens({ ...baseParams, systemPrompt: "Be helpful" });

    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ system: "Be helpful" }),
    );
  });

  it("omits system from the request when no system prompt is provided", async () => {
    const mockStream = setupMock(createMockStream(["ok"]));

    await collectTokens(baseParams);

    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("system");
  });

  it("creates the client with the provided API key and timeout", async () => {
    setupMock(createMockStream(["ok"]));

    await collectTokens({ ...baseParams, timeout: 10_000 });

    expect(Anthropic).toHaveBeenCalledWith({
      apiKey: "test-key",
      timeout: 10_000,
    });
  });

  it("uses default timeout of 30000ms", async () => {
    setupMock(createMockStream(["ok"]));

    await collectTokens(baseParams);

    expect(Anthropic).toHaveBeenCalledWith({
      apiKey: "test-key",
      timeout: 30_000,
    });
  });

  it("maps 401 errors to INVALID_API_KEY", async () => {
    const ApiError = Anthropic.APIError as unknown as new (
      status: number,
      message: string,
    ) => Error;
    setupThrowingMock(new ApiError(401, "Unauthorized"));

    const result = collectTokens(baseParams);
    await expect(result).rejects.toThrow(LlmError);
    await expect(result).rejects.toMatchObject({ code: "INVALID_API_KEY" });
  });

  it("maps 429 errors to RATE_LIMITED", async () => {
    const ApiError = Anthropic.APIError as unknown as new (
      status: number,
      message: string,
    ) => Error;
    setupThrowingMock(new ApiError(429, "Too many requests"));

    const result = collectTokens(baseParams);
    await expect(result).rejects.toThrow(LlmError);
    await expect(result).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("maps 529 errors to OVERLOADED", async () => {
    const ApiError = Anthropic.APIError as unknown as new (
      status: number,
      message: string,
    ) => Error;
    setupThrowingMock(new ApiError(529, "Overloaded"));

    const result = collectTokens(baseParams);
    await expect(result).rejects.toThrow(LlmError);
    await expect(result).rejects.toMatchObject({ code: "OVERLOADED" });
  });

  it("maps timeout errors to TIMEOUT", async () => {
    const TimeoutError =
      Anthropic.APIConnectionTimeoutError as unknown as new () => Error;
    setupThrowingMock(new TimeoutError());

    const result = collectTokens(baseParams);
    await expect(result).rejects.toThrow(LlmError);
    await expect(result).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("handles errors thrown during stream iteration", async () => {
    const ApiError = Anthropic.APIError as unknown as new (
      status: number,
      message: string,
    ) => Error;
    setupStreamErrorMock("partial", new ApiError(429, "Rate limited"));

    const generator = streamCompletion(baseParams);

    const first = await generator.next();
    expect(first.value).toBe("partial");

    await expect(generator.next()).rejects.toThrow(LlmError);
  });
});
