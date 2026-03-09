import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, StreamParams } from "./types";
import { LlmError } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_TIMEOUT = 30_000;

function mapSdkError(error: unknown): LlmError {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) {
      return new LlmError("INVALID_API_KEY", "Invalid API key");
    }
    if (error.status === 429) {
      return new LlmError("RATE_LIMITED", "Rate limited by Anthropic API");
    }
    if (error.status === 529) {
      return new LlmError("OVERLOADED", "Anthropic API is overloaded");
    }
    return new LlmError("UNKNOWN", error.message);
  }

  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new LlmError("TIMEOUT", "Request timed out");
  }

  if (error instanceof Error) {
    return new LlmError("UNKNOWN", error.message);
  }

  return new LlmError("UNKNOWN", String(error));
}

export const anthropicProvider: LlmProvider = {
  async *stream(params: StreamParams): AsyncGenerator<string> {
    const {
      messages,
      apiKey,
      model = DEFAULT_MODEL,
      systemPrompt,
      timeout = DEFAULT_TIMEOUT,
    } = params;

    const client = new Anthropic({ apiKey, timeout });

    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        ...(systemPrompt ? { system: systemPrompt } : {}),
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      throw mapSdkError(error);
    }
  },
};
