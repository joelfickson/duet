import type { FastifyInstance } from "fastify";
import { createSession, getSession } from "../services/sessions";

export async function sessionsRoute(server: FastifyInstance): Promise<void> {
  server.post<{ Body: { title?: string } }>(
    "/api/sessions",
    async (request, reply) => {
      const { title } = request.body ?? {};
      const session = createSession(title);
      return reply.status(201).send(session);
    },
  );

  server.get<{ Params: { id: string } }>(
    "/api/sessions/:id/exists",
    async (request) => {
      const session = getSession(request.params.id);
      return { exists: session !== null };
    },
  );
}
