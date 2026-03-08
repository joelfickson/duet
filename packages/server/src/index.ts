import { buildApp } from "./app";

const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || "0.0.0.0";

const server = await buildApp();

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
