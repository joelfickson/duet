import type { FastifyInstance } from "fastify";

export async function healthRoute(server: FastifyInstance): Promise<void> {
  server.get("/health", async () => {
    return { status: "ok" };
  });
}
