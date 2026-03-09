import { randomUUID } from "node:crypto";
import type { Message, WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type BroadcastService from "./broadcast";
import type ContextService from "./context";
import { getProvider, LlmError, type ProviderId } from "./providers";
import type RetryService from "./retry";
import type SessionService from "./sessions";
import type SystemPromptService from "./system-prompt";

interface SessionConfig {
  apiKey: string;
  provider: ProviderId;
  model?: string;
}

const serverAnthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const serverGeminiKey = process.env.GEMINI_API_KEY ?? "";
const serverOpenrouterKey = process.env.OPENROUTER_API_KEY ?? "";

export default class AiService {
  private configs = new Map<string, SessionConfig>();
  private messages = new Map<string, Message[]>();
  private activeStreams = new Map<string, boolean>();

  constructor(
    private broadcast: BroadcastService,
    private context: ContextService,
    private sessions: SessionService,
    private systemPrompt: SystemPromptService,
    private retry: RetryService,
  ) {}

  setSessionConfig(
    sessionId: string,
    apiKey: string,
    provider: ProviderId = "anthropic",
    model?: string,
  ): void {
    this.configs.set(sessionId, { apiKey, provider, model });
  }

  getSessionApiKey(sessionId: string): string | null {
    const config = this.configs.get(sessionId);
    if (config) return config.apiKey;
    const defaultKey = this.getDefaultApiKey(this.getDefaultProvider());
    return defaultKey || null;
  }

  getSessionProvider(sessionId: string): ProviderId {
    return this.configs.get(sessionId)?.provider ?? this.getDefaultProvider();
  }

  clearSessionState(sessionId: string): void {
    this.configs.delete(sessionId);
    this.messages.delete(sessionId);
    this.activeStreams.delete(sessionId);
  }

  addMessageToHistory(sessionId: string, message: Message): void {
    let messages = this.messages.get(sessionId);
    if (!messages) {
      messages = [];
      this.messages.set(sessionId, messages);
    }
    messages.push(message);
  }

  getMessageHistory(sessionId: string): Message[] {
    return this.messages.get(sessionId) ?? [];
  }

  async triggerAiResponse(sessionId: string): Promise<void> {
    if (this.activeStreams.get(sessionId)) return;

    const apiKey = this.getSessionApiKey(sessionId);
    if (!apiKey) {
      this.broadcast.toSession(sessionId, {
        type: WsEvent.AiError,
        sessionId,
        code: "NO_API_KEY",
        message:
          "No API key configured. Set ANTHROPIC_API_KEY / GEMINI_API_KEY or provide one when creating the session.",
      } as WsPayload);
      return;
    }

    const messages = this.getMessageHistory(sessionId);
    if (messages.length === 0) return;

    const participants = this.sessions.getParticipants(sessionId);
    const systemPrompt = this.systemPrompt.build(participants);
    const context = this.context.buildContext(messages);
    const config = this.configs.get(sessionId);
    const providerId = config?.provider ?? this.getDefaultProvider();
    const provider = getProvider(providerId);
    const model = config?.model;

    const messageCountAtStart = messages.length;
    this.activeStreams.set(sessionId, true);
    let fullContent = "";
    let seq = 0;

    try {
      const stream = this.retry.withRetry(() =>
        provider.stream({
          messages: context,
          apiKey,
          systemPrompt,
          model,
        }),
      );

      for await (const token of stream) {
        fullContent += token;
        seq++;

        const chunkPayload: WsPayload = {
          type: WsEvent.AiChunk,
          sessionId,
          token,
          seq,
        };
        this.broadcast.toSession(sessionId, chunkPayload);
      }

      const aiMessage: Message = {
        id: randomUUID(),
        sessionId,
        senderId: "ai",
        senderName: "AI",
        content: fullContent,
        role: "assistant",
        createdAt: new Date().toISOString(),
      };

      this.addMessageToHistory(sessionId, aiMessage);

      const donePayload: WsPayload = {
        type: WsEvent.AiDone,
        sessionId,
        message: aiMessage,
      };
      this.broadcast.toSession(sessionId, donePayload);
    } catch (error) {
      const llmError =
        error instanceof LlmError
          ? error
          : new LlmError("UNKNOWN", String(error));

      const errorPayload: WsPayload = {
        type: WsEvent.AiError,
        sessionId,
        code: llmError.code,
        message: llmError.message,
      };
      this.broadcast.toSession(sessionId, errorPayload);
    } finally {
      this.activeStreams.delete(sessionId);
    }

    const currentMessages = this.getMessageHistory(sessionId);
    const newUserMessages = currentMessages
      .slice(messageCountAtStart)
      .some((m) => m.role === "user");
    if (newUserMessages) {
      await this.triggerAiResponse(sessionId);
    }
  }

  private getDefaultProvider(): ProviderId {
    if (serverAnthropicKey) return "anthropic";
    if (serverGeminiKey) return "gemini";
    if (serverOpenrouterKey) return "openrouter";
    return "anthropic";
  }

  private getDefaultApiKey(provider: ProviderId): string {
    if (provider === "gemini") return serverGeminiKey;
    if (provider === "openrouter") return serverOpenrouterKey;
    return serverAnthropicKey;
  }
}
