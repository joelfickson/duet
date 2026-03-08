import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { addConnection, removeConnection } from "./connections.js";

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

const server = Fastify({ logger: true });

await server.register(websocket);

server.get("/health", async () => {
  return { status: "ok" };
});

server.get("/ws", { websocket: true }, (socket, _req) => {
  const conn = addConnection(socket);
  server.log.debug({ connectionId: conn.id }, "connection opened");

  socket.on("message", (raw: Buffer) => {
    server.log.debug(
      { connectionId: conn.id, raw: raw.toString() },
      "message received",
    );
  });

  socket.on("close", () => {
    removeConnection(conn.id);
    server.log.debug({ connectionId: conn.id }, "connection closed");
  });

  socket.on("error", (err: Error) => {
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
