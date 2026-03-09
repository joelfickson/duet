import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";
import { initDatabase } from "./db/database";
import { runMigrations } from "./db/migrate";
import servicesPlugin from "./plugins/services";
import { healthRoute } from "./routes/health";
import { sessionsRoute } from "./routes/sessions";
import { wsRoute } from "./routes/ws";

export interface AppOptions extends FastifyServerOptions {
  dbPath?: string;
  skipMigrations?: boolean;
}

export async function buildApp(opts: AppOptions = {}) {
  if (!opts.skipMigrations) {
    const db = initDatabase(opts.dbPath);
    runMigrations(db);
  }

  const server = Fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL ?? "info",
    },
    ...opts,
  });

  await server.register(cors, { origin: true });
  await server.register(websocket);
  await server.register(servicesPlugin);
  await server.register(healthRoute);
  await server.register(sessionsRoute);
  await server.register(wsRoute);

  return server;
}
