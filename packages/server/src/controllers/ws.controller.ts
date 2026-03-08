import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type { FastifyBaseLogger } from "fastify";
import { broadcastPresence, broadcastToSession } from "../services/broadcast";
import type { Connection } from "../services/connections";
import {
  getSessionForConnection,
  mapConnectionToSession,
  unmapConnectionFromSession,
} from "../services/connections";
import { createMessage, validateMessageContent } from "../services/messages";
import {
  getParticipants,
  joinSession,
  leaveSession,
} from "../services/sessions";
import { clearTyping, isTyping, setTyping } from "../services/typing";

function sendError(conn: Connection, code: string, message: string): void {
  const payload: WsPayload = {
    type: WsEvent.Error,
    code,
    message,
  };
  conn.socket.send(JSON.stringify(payload));
}

export function handleJoin(
  conn: Connection,
  data: WsPayload,
  log: FastifyBaseLogger,
): void {
  if (data.type !== WsEvent.Join) return;

  const session = joinSession(data.sessionId, data.participant);
  if (!session) {
    log.warn({ sessionId: data.sessionId }, "join failed: session not found");
    sendError(conn, "SESSION_NOT_FOUND", `Session ${data.sessionId} not found`);
    return;
  }

  mapConnectionToSession(conn.id, data.sessionId, data.participant.id);
  log.info(
    { sessionId: data.sessionId, participantId: data.participant.id },
    "participant joined",
  );
  broadcastPresence(data.sessionId);
}

export function handleLeave(conn: Connection, log: FastifyBaseLogger): void {
  const sessionId = getSessionForConnection(conn.id);
  if (!sessionId || !conn.participantId) return;

  if (isTyping(sessionId, conn.participantId)) {
    clearTyping(sessionId, conn.participantId);
    const stopPayload: WsPayload = {
      type: WsEvent.Typing,
      sessionId,
      participantId: conn.participantId,
      isTyping: false,
    };
    broadcastToSession(sessionId, stopPayload, conn.id);
  }

  log.info(
    { sessionId, participantId: conn.participantId },
    "participant left",
  );
  leaveSession(sessionId, conn.participantId);
  unmapConnectionFromSession(conn.id);
  broadcastPresence(sessionId);
}

export function handleMessage(
  conn: Connection,
  data: WsPayload,
  log: FastifyBaseLogger,
): void {
  if (data.type !== WsEvent.Message) return;

  const sessionId = getSessionForConnection(conn.id);
  if (!sessionId || !conn.participantId) return;

  const incoming = data.message;
  if (!validateMessageContent(incoming?.content)) {
    log.warn({ sessionId }, "invalid message content");
    sendError(
      conn,
      "INVALID_MESSAGE",
      "Message content must be a non-empty string",
    );
    return;
  }

  const participants = getParticipants(sessionId);
  const sender = participants.find((p) => p.id === conn.participantId);
  if (!sender) return;

  if (isTyping(sessionId, conn.participantId)) {
    clearTyping(sessionId, conn.participantId);
    const stopPayload: WsPayload = {
      type: WsEvent.Typing,
      sessionId,
      participantId: conn.participantId,
      isTyping: false,
    };
    broadcastToSession(sessionId, stopPayload, conn.id);
  }

  const message = createMessage(
    sessionId,
    sender.id,
    sender.name,
    incoming.content,
  );

  log.info(
    { sessionId, messageId: message.id, senderId: sender.id },
    "message broadcast",
  );

  const broadcastPayload: WsPayload = {
    type: WsEvent.Message,
    message,
  };
  broadcastToSession(sessionId, broadcastPayload, conn.id);

  const ackPayload: WsPayload = {
    type: WsEvent.MessageAck,
    messageId: message.id,
    sessionId,
    createdAt: message.createdAt,
  };
  conn.socket.send(JSON.stringify(ackPayload));
}

export function handleTyping(
  conn: Connection,
  data: WsPayload,
  log: FastifyBaseLogger,
): void {
  if (data.type !== WsEvent.Typing) return;

  const sessionId = getSessionForConnection(conn.id);
  if (!sessionId || !conn.participantId) return;

  const participantId = conn.participantId;

  if (data.isTyping) {
    setTyping(sessionId, participantId, () => {
      log.debug({ sessionId, participantId }, "typing timeout");
      const stopPayload: WsPayload = {
        type: WsEvent.Typing,
        sessionId,
        participantId,
        isTyping: false,
      };
      broadcastToSession(sessionId, stopPayload);
    });
  } else {
    clearTyping(sessionId, participantId);
  }

  log.debug(
    { sessionId, participantId, isTyping: data.isTyping },
    "typing event",
  );

  const payload: WsPayload = {
    type: WsEvent.Typing,
    sessionId,
    participantId,
    isTyping: data.isTyping,
  };
  broadcastToSession(sessionId, payload, conn.id);
}
