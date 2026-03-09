import type { FastifyInstance } from "fastify";
import type { ProviderId } from "../services/providers";

export async function sessionsRoute(server: FastifyInstance): Promise<void> {
  server.post<{
    Body: {
      title?: string;
      apiKey?: string;
      provider?: ProviderId;
      model?: string;
    };
  }>("/api/sessions", async (request, reply) => {
    const { title, apiKey, provider, model } = request.body ?? {};
    const session = server.sessionService.create(title);
    if (apiKey || provider || model) {
      server.aiService.setSessionConfig(
        session.id,
        apiKey ?? "",
        provider ?? "anthropic",
        model,
      );
    }
    return reply.status(201).send(session);
  });

  server.get<{ Params: { id: string } }>(
    "/api/sessions/:id/exists",
    async (request) => {
      const session = server.sessionService.get(request.params.id);
      return { exists: session !== null };
    },
  );
}
