import type { FastifyInstance } from "fastify";
import { getSession } from "../services/sessions";

export async function sessionsRoute(server: FastifyInstance): Promise<void> {
  server.get<{ Params: { id: string } }>(
    "/api/sessions/:id/exists",
    async (request) => {
      const session = getSession(request.params.id);
      return { exists: session !== null };
    },
  );
}
