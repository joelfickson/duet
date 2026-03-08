import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { clearAllConnections } from "../services/connections";
import { clearAllHeartbeats } from "../services/heartbeat";
import { clearAllDisconnected } from "../services/reconnection";
import {
  createSession,
  destroySession,
  getAllSessions,
} from "../services/sessions";
import { clearAllTyping } from "../services/typing";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeEach(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  for (const s of getAllSessions()) {
    destroySession(s.id);
  }
  clearAllConnections();
  clearAllTyping();
  clearAllHeartbeats();
  clearAllDisconnected();
  await app.close();
});

describe("GET /api/sessions/:id/exists", () => {
  it("returns exists: true for an active session", async () => {
    const session = createSession("test");

    const response = await app.inject({
      method: "GET",
      url: `/api/sessions/${session.id}/exists`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exists: true });
  });

  it("returns exists: false for a nonexistent session", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/sessions/nonexistent/exists",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exists: false });
  });

  it("returns exists: false after a session is destroyed", async () => {
    const session = createSession("test");
    destroySession(session.id);

    const response = await app.inject({
      method: "GET",
      url: `/api/sessions/${session.id}/exists`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exists: false });
  });
});
