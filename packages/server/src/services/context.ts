import type { Message } from "@duet/shared";
import type { LlmMessage } from "./providers";

const DEFAULT_MAX_TOKENS = 100_000;
const CHARS_PER_TOKEN = 4;

export default class ContextService {
  buildContext(
    messages: Message[],
    maxTokens: number = DEFAULT_MAX_TOKENS,
  ): LlmMessage[] {
    const sorted = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const result: LlmMessage[] = [];
    let estimatedTokens = 0;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const msg = sorted[i];
      const content =
        msg.role === "user" ? `${msg.senderName}: ${msg.content}` : msg.content;
      const tokens = Math.ceil(content.length / CHARS_PER_TOKEN);

      if (estimatedTokens + tokens > maxTokens) break;
      estimatedTokens += tokens;

      result.unshift({
        role: msg.role === "user" ? "user" : "assistant",
        content,
      });
    }

    return result;
  }
}
