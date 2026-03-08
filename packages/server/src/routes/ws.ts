import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type { FastifyInstance } from "fastify";
import {
  handleJoin,
  handleLeave,
  handleMessage,
} from "../controllers/ws.controller";
import { addConnection, removeConnection } from "../services/connections";

export async function wsRoute(server: FastifyInstance): Promise<void> {
  server.get("/ws", { websocket: true }, (socket, _req) => {
    const conn = addConnection(socket);
    const log = server.log.child({ connectionId: conn.id });

    log.debug("ws connection opened");

    socket.on("message", (raw: Buffer) => {
      let data: WsPayload;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        log.warn("received invalid JSON");
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
      }
    });

    socket.on("close", () => {
      handleLeave(conn, log);
      removeConnection(conn.id);
      log.debug("ws connection closed");
    });

    socket.on("error", (err) => {
      log.error({ err }, "ws connection error");
      handleLeave(conn, log);
      removeConnection(conn.id);
    });
  });
}
