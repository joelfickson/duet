import Fastify from "fastify";

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

const server = Fastify({ logger: true });

server.get("/health", async () => {
  return { status: "ok" };
});

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
