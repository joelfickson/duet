import { GoogleGenAI } from "@google/genai";
import type { LlmProvider, StreamParams } from "./types";
import { LlmError } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT = 30_000;

function mapSdkError(error: unknown): LlmError {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("api key") ||
      msg.includes("401") ||
      msg.includes("unauthorized")
    ) {
      return new LlmError("INVALID_API_KEY", "Invalid Gemini API key");
    }
    if (msg.includes("429") || msg.includes("rate") || msg.includes("quota")) {
      return new LlmError("RATE_LIMITED", "Rate limited by Gemini API");
    }
    if (msg.includes("503") || msg.includes("overloaded")) {
      return new LlmError("OVERLOADED", "Gemini API is overloaded");
    }
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return new LlmError("TIMEOUT", "Request timed out");
    }
    return new LlmError("UNKNOWN", error.message);
  }
  return new LlmError("UNKNOWN", String(error));
}

export const geminiProvider: LlmProvider = {
  async *stream(params: StreamParams): AsyncGenerator<string> {
    const {
      messages,
      apiKey,
      model = DEFAULT_MODEL,
      systemPrompt,
      timeout = DEFAULT_TIMEOUT,
    } = params;

    const client = new GoogleGenAI({ apiKey, httpOptions: { timeout } });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    try {
      const response = await client.models.generateContentStream({
        model,
        contents,
        config: {
          maxOutputTokens: 4096,
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        },
      });

      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      throw mapSdkError(error);
    }
  },
};
