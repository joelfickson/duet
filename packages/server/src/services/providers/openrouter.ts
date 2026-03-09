import OpenAI from "openai";
import type { LlmProvider, StreamParams } from "./types";
import { LlmError } from "./types";

const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
const DEFAULT_TIMEOUT = 30_000;

function mapSdkError(error: unknown): LlmError {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      return new LlmError("INVALID_API_KEY", "Invalid OpenRouter API key");
    }
    if (error.status === 429) {
      return new LlmError("RATE_LIMITED", "Rate limited by OpenRouter");
    }
    if (error.status === 503) {
      return new LlmError("OVERLOADED", "OpenRouter is overloaded");
    }
    return new LlmError("UNKNOWN", error.message);
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new LlmError("TIMEOUT", "Request timed out");
  }

  if (error instanceof Error) {
    return new LlmError("UNKNOWN", error.message);
  }

  return new LlmError("UNKNOWN", String(error));
}

export const openrouterProvider: LlmProvider = {
  async *stream(params: StreamParams): AsyncGenerator<string> {
    const {
      messages,
      apiKey,
      model = DEFAULT_MODEL,
      systemPrompt,
      timeout = DEFAULT_TIMEOUT,
    } = params;

    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      timeout,
    });

    const systemMessages: OpenAI.ChatCompletionMessageParam[] = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : [];

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(
      (m) => ({
        role: m.role,
        content: m.content,
      }),
    );

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: [...systemMessages, ...chatMessages],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      throw mapSdkError(error);
    }
  },
};
