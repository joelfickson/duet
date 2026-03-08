import { randomUUID } from "node:crypto";
import type { Message, WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import {
  addConnection,
  getConnectionsForSession,
  getSessionForConnection,
  mapConnectionToSession,
  removeConnection,
  unmapConnectionFromSession,
} from "./connections.js";
import { getParticipants, joinSession, leaveSession } from "./sessions.js";

export async function buildApp() {
  const server = Fastify({ logger: false });

  await server.register(websocket);

  server.get("/health", async () => {
    return { status: "ok" };
  });

  function broadcastToSession(
    sessionId: string,
    payload: WsPayload,
    excludeConnectionId?: string,
  ): void {
    const msg = JSON.stringify(payload);
    for (const conn of getConnectionsForSession(sessionId)) {
      if (conn.id === excludeConnectionId) continue;
      if (conn.socket.readyState === conn.socket.OPEN) {
        conn.socket.send(msg);
      }
    }
  }

  function broadcastPresence(sessionId: string): void {
    const participants = getParticipants(sessionId);
    const payload: WsPayload = {
      type: WsEvent.Presence,
      sessionId,
      participants,
    };
    broadcastToSession(sessionId, payload);
  }

  function handleJoin(
    conn: ReturnType<typeof addConnection>,
    data: WsPayload,
  ): void {
    if (data.type !== WsEvent.Join) return;

    const session = joinSession(data.sessionId, data.participant);
    if (!session) {
      const errorPayload: WsPayload = {
        type: WsEvent.Error,
        code: "SESSION_NOT_FOUND",
        message: `Session ${data.sessionId} not found`,
      };
      conn.socket.send(JSON.stringify(errorPayload));
      return;
    }

    mapConnectionToSession(conn.id, data.sessionId, data.participant.id);
    broadcastPresence(data.sessionId);
  }

  function handleLeave(conn: ReturnType<typeof addConnection>): void {
    const sessionId = getSessionForConnection(conn.id);
    if (!sessionId || !conn.participantId) return;

    leaveSession(sessionId, conn.participantId);
    unmapConnectionFromSession(conn.id);
    broadcastPresence(sessionId);
  }

  function handleMessage(
    conn: ReturnType<typeof addConnection>,
    data: WsPayload,
  ): void {
    if (data.type !== WsEvent.Message) return;

    const sessionId = getSessionForConnection(conn.id);
    if (!sessionId || !conn.participantId) return;

    const incoming = data.message;
    if (
      !incoming?.content ||
      typeof incoming.content !== "string" ||
      incoming.content.trim() === ""
    ) {
      const errorPayload: WsPayload = {
        type: WsEvent.Error,
        code: "INVALID_MESSAGE",
        message: "Message content must be a non-empty string",
      };
      conn.socket.send(JSON.stringify(errorPayload));
      return;
    }

    const participants = getParticipants(sessionId);
    const sender = participants.find((p) => p.id === conn.participantId);
    if (!sender) return;

    const message: Message = {
      id: randomUUID(),
      sessionId,
      senderId: sender.id,
      senderName: sender.name,
      content: incoming.content.trim(),
      role: "user",
      createdAt: new Date().toISOString(),
    };

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

  server.get("/ws", { websocket: true }, (socket, _req) => {
    const conn = addConnection(socket);

    socket.on("message", (raw: Buffer) => {
      let data: WsPayload;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (data.type) {
        case WsEvent.Join:
          handleJoin(conn, data);
          break;
        case WsEvent.Leave:
          handleLeave(conn);
          break;
        case WsEvent.Message:
          handleMessage(conn, data);
          break;
      }
    });

    socket.on("close", () => {
      handleLeave(conn);
      removeConnection(conn.id);
    });

    socket.on("error", () => {
      handleLeave(conn);
      removeConnection(conn.id);
    });
  });

  return server;
}
