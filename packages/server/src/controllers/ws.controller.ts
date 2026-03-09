import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Connection } from "../services/connections";

export default class WsController {
  constructor(private server: FastifyInstance) {}

  handleJoin(conn: Connection, data: WsPayload, log: FastifyBaseLogger): void {
    if (data.type !== WsEvent.Join) return;

    const { sessionService, connectionService, broadcastService } = this.server;

    const session = sessionService.join(data.sessionId, data.participant);
    if (!session) {
      log.warn({ sessionId: data.sessionId }, "join failed: session not found");
      this.sendError(
        conn,
        "SESSION_NOT_FOUND",
        `Session ${data.sessionId} not found`,
      );
      return;
    }

    connectionService.mapToSession(
      conn.id,
      data.sessionId,
      data.participant.id,
    );
    log.info(
      { sessionId: data.sessionId, participantId: data.participant.id },
      "participant joined",
    );
    broadcastService.presence(data.sessionId);
  }

  handleLeave(conn: Connection, log: FastifyBaseLogger): void {
    const {
      connectionService,
      sessionService,
      typingService,
      broadcastService,
      reconnectionService,
    } = this.server;

    const sessionId = connectionService.getSessionForConnection(conn.id);
    if (!sessionId || !conn.participantId) return;

    if (typingService.isTyping(sessionId, conn.participantId)) {
      typingService.clear(sessionId, conn.participantId);
      const stopPayload: WsPayload = {
        type: WsEvent.Typing,
        sessionId,
        participantId: conn.participantId,
        isTyping: false,
      };
      broadcastService.toSession(sessionId, stopPayload, conn.id);
    }

    const participants = sessionService.getParticipants(sessionId);
    const participant = participants.find((p) => p.id === conn.participantId);
    if (participant) {
      reconnectionService.stash(sessionId, participant);
    }

    log.info(
      { sessionId, participantId: conn.participantId },
      "participant left",
    );
    sessionService.leave(sessionId, conn.participantId);
    connectionService.unmapFromSession(conn.id);
    broadcastService.presence(sessionId);
  }

  handleMessage(
    conn: Connection,
    data: WsPayload,
    log: FastifyBaseLogger,
  ): void {
    if (data.type !== WsEvent.Message) return;

    const {
      connectionService,
      sessionService,
      typingService,
      broadcastService,
      messageService,
      reconnectionService,
      aiService,
    } = this.server;

    const sessionId = connectionService.getSessionForConnection(conn.id);
    if (!sessionId || !conn.participantId) return;

    const incoming = data.message;
    if (!messageService.validateContent(incoming?.content)) {
      log.warn({ sessionId }, "invalid message content");
      this.sendError(
        conn,
        "INVALID_MESSAGE",
        "Message content must be a non-empty string",
      );
      return;
    }

    const participants = sessionService.getParticipants(sessionId);
    const sender = participants.find((p) => p.id === conn.participantId);
    if (!sender) return;

    if (typingService.isTyping(sessionId, conn.participantId)) {
      typingService.clear(sessionId, conn.participantId);
      const stopPayload: WsPayload = {
        type: WsEvent.Typing,
        sessionId,
        participantId: conn.participantId,
        isTyping: false,
      };
      broadcastService.toSession(sessionId, stopPayload, conn.id);
    }

    const message = messageService.create(
      sessionId,
      sender.id,
      sender.name,
      incoming.content,
      incoming.replyTo,
    );

    log.info(
      { sessionId, messageId: message.id, senderId: sender.id },
      "message broadcast",
    );

    reconnectionService.bufferMessage(sessionId, message);
    aiService.addMessageToHistory(sessionId, message);

    const broadcastPayload: WsPayload = {
      type: WsEvent.Message,
      message,
    };
    broadcastService.toSession(sessionId, broadcastPayload, conn.id);

    const ackPayload: WsPayload = {
      type: WsEvent.MessageAck,
      messageId: message.id,
      sessionId,
      createdAt: message.createdAt,
    };
    conn.socket.send(JSON.stringify(ackPayload));

    aiService.triggerAiResponse(sessionId).catch((err) => {
      log.error({ err, sessionId }, "ai response failed");
    });
  }

  handleTyping(
    conn: Connection,
    data: WsPayload,
    log: FastifyBaseLogger,
  ): void {
    if (data.type !== WsEvent.Typing) return;

    const { connectionService, typingService, broadcastService } = this.server;

    const sessionId = connectionService.getSessionForConnection(conn.id);
    if (!sessionId || !conn.participantId) return;

    const participantId = conn.participantId;

    if (data.isTyping) {
      typingService.set(sessionId, participantId, () => {
        log.debug({ sessionId, participantId }, "typing timeout");
        const stopPayload: WsPayload = {
          type: WsEvent.Typing,
          sessionId,
          participantId,
          isTyping: false,
        };
        broadcastService.toSession(sessionId, stopPayload);
      });
    } else {
      typingService.clear(sessionId, participantId);
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
    broadcastService.toSession(sessionId, payload, conn.id);
  }

  handleReconnect(
    conn: Connection,
    data: WsPayload,
    log: FastifyBaseLogger,
  ): void {
    if (data.type !== WsEvent.Reconnect) return;

    const {
      reconnectionService,
      sessionService,
      connectionService,
      broadcastService,
    } = this.server;

    const result = reconnectionService.tryReconnect(
      data.sessionId,
      data.participantId,
    );
    if (!result) {
      log.warn(
        { sessionId: data.sessionId, participantId: data.participantId },
        "reconnect failed: no stashed session or grace period expired",
      );
      this.sendError(
        conn,
        "RECONNECT_FAILED",
        "No active reconnection window for this participant",
      );
      return;
    }

    const session = sessionService.join(data.sessionId, result.participant);
    if (!session) {
      this.sendError(
        conn,
        "SESSION_NOT_FOUND",
        `Session ${data.sessionId} not found`,
      );
      return;
    }

    connectionService.mapToSession(
      conn.id,
      data.sessionId,
      result.participant.id,
    );
    log.info(
      {
        sessionId: data.sessionId,
        participantId: result.participant.id,
        missedMessages: result.missedMessages.length,
      },
      "participant reconnected",
    );

    for (const msg of result.missedMessages) {
      const payload: WsPayload = {
        type: WsEvent.Message,
        message: msg,
      };
      conn.socket.send(JSON.stringify(payload));
    }

    broadcastService.presence(data.sessionId);
  }

  private sendError(conn: Connection, code: string, message: string): void {
    const payload: WsPayload = {
      type: WsEvent.Error,
      code,
      message,
    };
    conn.socket.send(JSON.stringify(payload));
  }
}
