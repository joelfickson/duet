import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllRateLimits,
  clearRateLimit,
  isRateLimited,
  setRateLimitConfig,
} from "./rate-limit";

beforeEach(() => {
  setRateLimitConfig(5, 1000);
  clearAllRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate limiting", () => {
  it("allows messages under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited("conn-1")).toBe(false);
    }
  });

  it("blocks messages over the limit", () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited("conn-1");
    }
    expect(isRateLimited("conn-1")).toBe(true);
  });

  it("uses a sliding window that expires old entries", () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited("conn-1");
    }
    expect(isRateLimited("conn-1")).toBe(true);

    vi.advanceTimersByTime(1001);

    expect(isRateLimited("conn-1")).toBe(false);
  });

  it("tracks connections independently", () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited("conn-1");
    }
    expect(isRateLimited("conn-1")).toBe(true);
    expect(isRateLimited("conn-2")).toBe(false);
  });

  it("clears state for a specific connection", () => {
    for (let i = 0; i < 5; i++) {
      isRateLimited("conn-1");
    }
    expect(isRateLimited("conn-1")).toBe(true);

    clearRateLimit("conn-1");
    expect(isRateLimited("conn-1")).toBe(false);
  });

  it("slides the window correctly with staggered messages", () => {
    for (let i = 0; i < 3; i++) {
      isRateLimited("conn-1");
    }

    vi.advanceTimersByTime(600);

    for (let i = 0; i < 2; i++) {
      isRateLimited("conn-1");
    }
    expect(isRateLimited("conn-1")).toBe(true);

    vi.advanceTimersByTime(500);

    expect(isRateLimited("conn-1")).toBe(false);
  });
});
