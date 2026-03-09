import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TypingService from "./typing";

describe("TypingService", () => {
  let service: TypingService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new TypingService();
  });

  afterEach(() => {
    service.clearAll();
    vi.useRealTimers();
  });

  it("marks a participant as typing", () => {
    service.set("sess-1", "p-1", vi.fn());
    expect(service.isTyping("sess-1", "p-1")).toBe(true);
  });

  it("returns false for non-typing participant", () => {
    expect(service.isTyping("sess-1", "p-1")).toBe(false);
  });

  it("clears typing for a participant", () => {
    service.set("sess-1", "p-1", vi.fn());
    service.clear("sess-1", "p-1");
    expect(service.isTyping("sess-1", "p-1")).toBe(false);
  });

  it("calls onTimeout after 3 seconds and removes typing state", () => {
    const onTimeout = vi.fn();
    service.set("sess-1", "p-1", onTimeout);

    vi.advanceTimersByTime(2999);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(service.isTyping("sess-1", "p-1")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(service.isTyping("sess-1", "p-1")).toBe(false);
  });

  it("resets timer when set is called again", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    service.set("sess-1", "p-1", cb1);
    vi.advanceTimersByTime(2000);

    service.set("sess-1", "p-1", cb2);
    vi.advanceTimersByTime(2000);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("tracks multiple participants independently", () => {
    service.set("sess-1", "p-1", vi.fn());
    service.set("sess-1", "p-2", vi.fn());

    expect(service.isTyping("sess-1", "p-1")).toBe(true);
    expect(service.isTyping("sess-1", "p-2")).toBe(true);

    service.clear("sess-1", "p-1");
    expect(service.isTyping("sess-1", "p-1")).toBe(false);
    expect(service.isTyping("sess-1", "p-2")).toBe(true);
  });

  it("tracks participants across sessions independently", () => {
    service.set("sess-1", "p-1", vi.fn());
    service.set("sess-2", "p-1", vi.fn());

    service.clear("sess-1", "p-1");
    expect(service.isTyping("sess-1", "p-1")).toBe(false);
    expect(service.isTyping("sess-2", "p-1")).toBe(true);
  });

  it("clearAll removes all entries", () => {
    service.set("sess-1", "p-1", vi.fn());
    service.set("sess-2", "p-2", vi.fn());

    service.clearAll();

    expect(service.isTyping("sess-1", "p-1")).toBe(false);
    expect(service.isTyping("sess-2", "p-2")).toBe(false);
  });

  it("clear is safe to call when not typing", () => {
    expect(() => service.clear("sess-1", "p-1")).not.toThrow();
  });
});
