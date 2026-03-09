import type { Participant } from "@duet/shared";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("includes participant count", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
      { id: "2", name: "Bob", connectedAt: new Date().toISOString() },
    ];
    const prompt = buildSystemPrompt(participants);
    expect(prompt).toContain("(2)");
  });

  it("includes participant names", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
      { id: "2", name: "Bob", connectedAt: new Date().toISOString() },
    ];
    const prompt = buildSystemPrompt(participants);
    expect(prompt).toContain("Alice, Bob");
  });

  it("handles single participant", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
    ];
    const prompt = buildSystemPrompt(participants);
    expect(prompt).toContain("(1)");
    expect(prompt).toContain("Alice");
  });

  it("handles empty participants", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("(0)");
  });
});
