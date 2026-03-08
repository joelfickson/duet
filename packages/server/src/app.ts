import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";
import { healthRoute } from "./routes/health";
import { sessionsRoute } from "./routes/sessions";
import { wsRoute } from "./routes/ws";

export async function buildApp(opts: FastifyServerOptions = {}) {
  const server = Fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL ?? "info",
    },
    ...opts,
  });

  await server.register(websocket);
  await server.register(healthRoute);
  await server.register(sessionsRoute);
  await server.register(wsRoute);

  return server;
}
