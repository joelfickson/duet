import type { WsPayload } from "@duet/shared";
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

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

const server = Fastify({ logger: true });

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

server.get("/ws", { websocket: true }, (socket, _req) => {
  const conn = addConnection(socket);
  server.log.debug({ connectionId: conn.id }, "connection opened");

  socket.on("message", (raw: Buffer) => {
    let data: WsPayload;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      server.log.debug({ connectionId: conn.id }, "invalid JSON received");
      return;
    }

    switch (data.type) {
      case WsEvent.Join:
        handleJoin(conn, data);
        break;
      case WsEvent.Leave:
        handleLeave(conn);
        break;
      default:
        server.log.debug(
          { connectionId: conn.id, type: data.type },
          "unhandled event type",
        );
    }
  });

  socket.on("close", () => {
    handleLeave(conn);
    removeConnection(conn.id);
    server.log.debug({ connectionId: conn.id }, "connection closed");
  });

  socket.on("error", (err: Error) => {
    handleLeave(conn);
    removeConnection(conn.id);
    server.log.debug({ connectionId: conn.id, err }, "connection error");
  });
});

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
