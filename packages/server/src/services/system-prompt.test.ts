import type { Participant } from "@duet/shared";
import { describe, expect, it } from "vitest";
import SystemPromptService from "./system-prompt";

describe("SystemPromptService", () => {
  const service = new SystemPromptService();

  it("includes participant count", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
      { id: "2", name: "Bob", connectedAt: new Date().toISOString() },
    ];
    const prompt = service.build(participants);
    expect(prompt).toContain("(2)");
  });

  it("includes participant names", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
      { id: "2", name: "Bob", connectedAt: new Date().toISOString() },
    ];
    const prompt = service.build(participants);
    expect(prompt).toContain("Alice, Bob");
  });

  it("handles single participant", () => {
    const participants: Participant[] = [
      { id: "1", name: "Alice", connectedAt: new Date().toISOString() },
    ];
    const prompt = service.build(participants);
    expect(prompt).toContain("(1)");
    expect(prompt).toContain("Alice");
  });

  it("handles empty participants", () => {
    const prompt = service.build([]);
    expect(prompt).toContain("(0)");
  });
});
