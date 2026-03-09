import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type { FastifyInstance } from "fastify";
import WsController from "../controllers/ws.controller";

export async function wsRoute(server: FastifyInstance): Promise<void> {
  const controller = new WsController(server);

  server.get("/ws", { websocket: true }, (socket, _req) => {
    const conn = server.connectionService.add(socket);
    const log = server.log.child({ connectionId: conn.id });

    log.debug("ws connection opened");

    server.heartbeatService.start(conn.id, socket, () => {
      log.warn("connection dead: missed pongs");
      controller.handleLeave(conn, log);
      server.connectionService.remove(conn.id);
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
        server.rateLimitService.isLimited(conn.id)
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
          controller.handleJoin(conn, data, log);
          break;
        case WsEvent.Leave:
          controller.handleLeave(conn, log);
          break;
        case WsEvent.Message:
          controller.handleMessage(conn, data, log);
          break;
        case WsEvent.Typing:
          controller.handleTyping(conn, data, log);
          break;
        case WsEvent.Reconnect:
          controller.handleReconnect(conn, data, log);
          break;
      }
    });

    socket.on("close", () => {
      server.heartbeatService.stop(conn.id);
      server.rateLimitService.clear(conn.id);
      controller.handleLeave(conn, log);
      server.connectionService.remove(conn.id);
      log.debug("ws connection closed");
    });

    socket.on("error", (err) => {
      log.error({ err }, "ws connection error");
      server.heartbeatService.stop(conn.id);
      server.rateLimitService.clear(conn.id);
      controller.handleLeave(conn, log);
      server.connectionService.remove(conn.id);
    });
  });
}
