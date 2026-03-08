import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type { FastifyInstance } from "fastify";
import {
  handleJoin,
  handleLeave,
  handleMessage,
  handleReconnect,
  handleTyping,
} from "../controllers/ws.controller";
import { addConnection, removeConnection } from "../services/connections";
import { startHeartbeat, stopHeartbeat } from "../services/heartbeat";
import { clearRateLimit, isRateLimited } from "../services/rate-limit";

export async function wsRoute(server: FastifyInstance): Promise<void> {
  server.get("/ws", { websocket: true }, (socket, _req) => {
    const conn = addConnection(socket);
    const log = server.log.child({ connectionId: conn.id });

    log.debug("ws connection opened");

    startHeartbeat(conn.id, socket, () => {
      log.warn("connection dead: missed pongs");
      handleLeave(conn, log);
      removeConnection(conn.id);
      socket.terminate();
    });

    socket.on("message", (raw: Buffer) => {
      let data: WsPayload;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        log.warn("received invalid JSON");
        return;
      }

      if (
        (data.type === WsEvent.Message || data.type === WsEvent.Typing) &&
        isRateLimited(conn.id)
      ) {
        log.warn({ connectionId: conn.id }, "rate limited");
        const errorPayload: WsPayload = {
          type: WsEvent.Error,
          code: "RATE_LIMITED",
          message: "Rate limit exceeded. Please slow down.",
        };
        socket.send(JSON.stringify(errorPayload));
        return;
      }

      switch (data.type) {
        case WsEvent.Join:
          handleJoin(conn, data, log);
          break;
        case WsEvent.Leave:
          handleLeave(conn, log);
          break;
        case WsEvent.Message:
          handleMessage(conn, data, log);
          break;
        case WsEvent.Typing:
          handleTyping(conn, data, log);
          break;
        case WsEvent.Reconnect:
          handleReconnect(conn, data, log);
          break;
      }
    });

    socket.on("close", () => {
      stopHeartbeat(conn.id);
      clearRateLimit(conn.id);
      handleLeave(conn, log);
      removeConnection(conn.id);
      log.debug("ws connection closed");
    });

    socket.on("error", (err) => {
      log.error({ err }, "ws connection error");
      stopHeartbeat(conn.id);
      clearRateLimit(conn.id);
      handleLeave(conn, log);
      removeConnection(conn.id);
    });
  });
}
