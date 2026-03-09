import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app";

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

beforeEach(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  for (const s of app.sessionService.getAll()) {
    app.sessionService.destroy(s.id);
  }
  app.connectionService.clearAll();
  app.typingService.clearAll();
  app.heartbeatService.clearAll();
  app.reconnectionService.clearAll();
  await app.close();
});

describe("POST /api/sessions", () => {
  it("creates a session with a title", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { title: "My session" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(body.title).toBe("My session");
    expect(body.participants).toEqual([]);
    expect(body.createdAt).toBeDefined();
  });

  it("creates a session without a title", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toMatch(/^[A-Za-z0-9]{10}$/);
    expect(body.title).toBeNull();
  });

  it("session is reachable via exists endpoint after creation", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { title: "test" },
    });
    const { id } = createRes.json();

    const existsRes = await app.inject({
      method: "GET",
      url: `/api/sessions/${id}/exists`,
    });

    expect(existsRes.json()).toEqual({ exists: true });
  });
});

describe("GET /api/sessions/:id/exists", () => {
  it("returns exists: true for an active session", async () => {
    const session = app.sessionService.create("test");

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
    const session = app.sessionService.create("test");
    app.sessionService.destroy(session.id);

    const response = await app.inject({
      method: "GET",
      url: `/api/sessions/${session.id}/exists`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exists: false });
  });
});
