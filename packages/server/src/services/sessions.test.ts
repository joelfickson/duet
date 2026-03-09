import { describe, expect, it } from "vitest";
import SessionService from "./sessions";

describe("SessionService", () => {
  it("generates a 10-character ID", () => {
    const service = new SessionService();
    const id = service.generateSessionId();
    expect(id).toHaveLength(10);
  });

  it("generates URL-safe alphanumeric IDs", () => {
    const service = new SessionService();
    for (let i = 0; i < 100; i++) {
      const id = service.generateSessionId();
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("does not produce collisions in 1000 samples", () => {
    const service = new SessionService();
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(service.generateSessionId());
    }
    expect(ids.size).toBe(1000);
  });

  it("create uses the new ID format", () => {
    const service = new SessionService();
    const session = service.create("test");
    expect(session.id).toHaveLength(10);
    expect(session.id).toMatch(/^[A-Za-z0-9]+$/);
  });
});
