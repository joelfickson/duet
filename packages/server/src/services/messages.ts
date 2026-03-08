import { randomUUID } from "node:crypto";
import type { Message } from "@duet/shared";

export function validateMessageContent(content: unknown): content is string {
  return typeof content === "string" && content.trim().length > 0;
}

export function createMessage(
  sessionId: string,
  senderId: string,
  senderName: string,
  content: string,
): Message {
  return {
    id: randomUUID(),
    sessionId,
    senderId,
    senderName,
    content: content.trim(),
    role: "user",
    createdAt: new Date().toISOString(),
  };
}
