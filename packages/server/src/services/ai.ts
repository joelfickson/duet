import { randomUUID } from "node:crypto";
import type { Message, WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { broadcastToSession } from "./broadcast";
import { buildContext } from "./context";
import { getProvider, LlmError, type ProviderId } from "./providers";
import { getParticipants } from "./sessions";
import { buildSystemPrompt } from "./system-prompt";

interface SessionConfig {
  apiKey: string;
  provider: ProviderId;
  model?: string;
}

const sessionConfigs = new Map<string, SessionConfig>();
const sessionMessages = new Map<string, Message[]>();
const activeStreams = new Map<string, boolean>();

const serverAnthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const serverGeminiKey = process.env.GEMINI_API_KEY ?? "";
const serverOpenrouterKey = process.env.OPENROUTER_API_KEY ?? "";

function getDefaultProvider(): ProviderId {
  if (serverAnthropicKey) return "anthropic";
  if (serverGeminiKey) return "gemini";
  if (serverOpenrouterKey) return "openrouter";
  return "anthropic";
}

function getDefaultApiKey(provider: ProviderId): string {
  if (provider === "gemini") return serverGeminiKey;
  if (provider === "openrouter") return serverOpenrouterKey;
  return serverAnthropicKey;
}

export function setSessionConfig(
  sessionId: string,
  apiKey: string,
  provider: ProviderId = "anthropic",
  model?: string,
): void {
  sessionConfigs.set(sessionId, { apiKey, provider, model });
}

export function getSessionApiKey(sessionId: string): string | null {
  const config = sessionConfigs.get(sessionId);
  if (config) return config.apiKey;
  const defaultKey = getDefaultApiKey(getDefaultProvider());
  return defaultKey || null;
}

export function getSessionProvider(sessionId: string): ProviderId {
  return sessionConfigs.get(sessionId)?.provider ?? getDefaultProvider();
}

export function clearSessionState(sessionId: string): void {
  sessionConfigs.delete(sessionId);
  sessionMessages.delete(sessionId);
  activeStreams.delete(sessionId);
}

export function addMessageToHistory(sessionId: string, message: Message): void {
  let messages = sessionMessages.get(sessionId);
  if (!messages) {
    messages = [];
    sessionMessages.set(sessionId, messages);
  }
  messages.push(message);
}

export function getMessageHistory(sessionId: string): Message[] {
  return sessionMessages.get(sessionId) ?? [];
}

export async function triggerAiResponse(sessionId: string): Promise<void> {
  if (activeStreams.get(sessionId)) return;

  const apiKey = getSessionApiKey(sessionId);
  if (!apiKey) {
    broadcastToSession(sessionId, {
      type: WsEvent.AiError,
      sessionId,
      code: "NO_API_KEY",
      message:
        "No API key configured. Set ANTHROPIC_API_KEY / GEMINI_API_KEY or provide one when creating the session.",
    } as WsPayload);
    return;
  }

  const messages = getMessageHistory(sessionId);
  if (messages.length === 0) return;

  const participants = getParticipants(sessionId);
  const systemPrompt = buildSystemPrompt(participants);
  const context = buildContext(messages);
  const config = sessionConfigs.get(sessionId);
  const providerId = config?.provider ?? getDefaultProvider();
  const provider = getProvider(providerId);
  const model = config?.model;

  activeStreams.set(sessionId, true);
  let fullContent = "";
  let seq = 0;

  try {
    const stream = provider.stream({
      messages: context,
      apiKey,
      systemPrompt,
      model,
    });

    for await (const token of stream) {
      fullContent += token;
      seq++;

      const chunkPayload: WsPayload = {
        type: WsEvent.AiChunk,
        sessionId,
        token,
        seq,
      };
      broadcastToSession(sessionId, chunkPayload);
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

    addMessageToHistory(sessionId, aiMessage);

    const donePayload: WsPayload = {
      type: WsEvent.AiDone,
      sessionId,
      message: aiMessage,
    };
    broadcastToSession(sessionId, donePayload);
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
    broadcastToSession(sessionId, errorPayload);
  } finally {
    activeStreams.delete(sessionId);
  }
}
