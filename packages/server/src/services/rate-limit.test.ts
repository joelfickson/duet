import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RateLimitService from "./rate-limit";

describe("RateLimitService", () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
    service.setConfig(5, 1000);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows messages under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(service.isLimited("conn-1")).toBe(false);
    }
  });

  it("blocks messages over the limit", () => {
    for (let i = 0; i < 5; i++) {
      service.isLimited("conn-1");
    }
    expect(service.isLimited("conn-1")).toBe(true);
  });

  it("uses a sliding window that expires old entries", () => {
    for (let i = 0; i < 5; i++) {
      service.isLimited("conn-1");
    }
    expect(service.isLimited("conn-1")).toBe(true);

    vi.advanceTimersByTime(1001);

    expect(service.isLimited("conn-1")).toBe(false);
  });

  it("tracks connections independently", () => {
    for (let i = 0; i < 5; i++) {
      service.isLimited("conn-1");
    }
    expect(service.isLimited("conn-1")).toBe(true);
    expect(service.isLimited("conn-2")).toBe(false);
  });

  it("clears state for a specific connection", () => {
    for (let i = 0; i < 5; i++) {
      service.isLimited("conn-1");
    }
    expect(service.isLimited("conn-1")).toBe(true);

    service.clear("conn-1");
    expect(service.isLimited("conn-1")).toBe(false);
  });

  it("slides the window correctly with staggered messages", () => {
    for (let i = 0; i < 3; i++) {
      service.isLimited("conn-1");
    }

    vi.advanceTimersByTime(600);

    for (let i = 0; i < 2; i++) {
      service.isLimited("conn-1");
    }
    expect(service.isLimited("conn-1")).toBe(true);

    vi.advanceTimersByTime(500);

    expect(service.isLimited("conn-1")).toBe(false);
  });
});
