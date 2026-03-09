import { randomUUID } from "node:crypto";
import type { Message, ReplyTo } from "@duet/shared";

export default class MessageService {
  validateContent(content: unknown): content is string {
    return typeof content === "string" && content.trim().length > 0;
  }

  create(
    sessionId: string,
    senderId: string,
    senderName: string,
    content: string,
    replyTo?: ReplyTo,
  ): Message {
    const message: Message = {
      id: randomUUID(),
      sessionId,
      senderId,
      senderName,
      content: content.trim(),
      role: "user",
      createdAt: new Date().toISOString(),
    };
    if (replyTo) {
      message.replyTo = replyTo;
    }
    return message;
  }
}
