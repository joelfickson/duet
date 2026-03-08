import { describe, expect, it } from "vitest";
import { createSession, generateSessionId } from "./sessions";

describe("session ID generation", () => {
  it("generates a 10-character ID", () => {
    const id = generateSessionId();
    expect(id).toHaveLength(10);
  });

  it("generates URL-safe alphanumeric IDs", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateSessionId();
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("does not produce collisions in 1000 samples", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(1000);
  });

  it("createSession uses the new ID format", () => {
    const session = createSession("test");
    expect(session.id).toHaveLength(10);
    expect(session.id).toMatch(/^[A-Za-z0-9]+$/);
  });
});
