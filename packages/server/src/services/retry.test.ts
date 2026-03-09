import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmError } from "./providers";
import RetryService from "./retry";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const service = new RetryService();

async function collectTokens(gen: AsyncGenerator<string>): Promise<string[]> {
  const tokens: string[] = [];
  for await (const t of gen) {
    tokens.push(t);
  }
  return tokens;
}

async function drainWithTimers(gen: AsyncGenerator<string>): Promise<string[]> {
  const tokens: string[] = [];
  let done = false;
  const promise = (async () => {
    for await (const t of gen) {
      tokens.push(t);
    }
    done = true;
  })();

  while (!done) {
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
  }

  await promise;
  return tokens;
}

async function drainExpectError(
  gen: AsyncGenerator<string>,
): Promise<LlmError> {
  let caught: LlmError | undefined;
  let done = false;

  const promise = (async () => {
    try {
      for await (const _ of gen) {
        /* consume */
      }
    } catch (e) {
      caught = e as LlmError;
    }
    done = true;
  })();

  while (!done) {
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
  }

  await promise;
  if (!caught) throw new Error("Expected an error to be thrown");
  return caught;
}

describe("RetryService", () => {
  it("yields tokens on first success", async () => {
    async function* ok() {
      yield "hello";
      yield " world";
    }

    const tokens = await collectTokens(service.withRetry(ok));
    expect(tokens).toEqual(["hello", " world"]);
  });

  it("retries RATE_LIMITED and succeeds", async () => {
    let calls = 0;
    async function* factory() {
      calls++;
      if (calls === 1) {
        throw new LlmError("RATE_LIMITED", "rate limited");
      }
      yield "ok";
    }

    const tokens = await drainWithTimers(service.withRetry(factory));
    expect(tokens).toEqual(["ok"]);
    expect(calls).toBe(2);
  });

  it("retries OVERLOADED and succeeds", async () => {
    let calls = 0;
    async function* factory() {
      calls++;
      if (calls <= 2) {
        throw new LlmError("OVERLOADED", "overloaded");
      }
      yield "recovered";
    }

    const tokens = await drainWithTimers(service.withRetry(factory));
    expect(tokens).toEqual(["recovered"]);
    expect(calls).toBe(3);
  });

  it("retries TIMEOUT and succeeds", async () => {
    let calls = 0;
    async function* factory() {
      calls++;
      if (calls === 1) {
        throw new LlmError("TIMEOUT", "timeout");
      }
      yield "done";
    }

    const tokens = await drainWithTimers(service.withRetry(factory));
    expect(tokens).toEqual(["done"]);
    expect(calls).toBe(2);
  });

  it("does not retry INVALID_API_KEY", async () => {
    let calls = 0;
    // biome-ignore lint/correctness/useYield: intentionally throws before yielding
    async function* factory() {
      calls++;
      throw new LlmError("INVALID_API_KEY", "bad key");
    }

    const err = await drainExpectError(service.withRetry(factory));
    expect(err.code).toBe("INVALID_API_KEY");
    expect(calls).toBe(1);
  });

  it("does not retry UNKNOWN", async () => {
    let calls = 0;
    // biome-ignore lint/correctness/useYield: intentionally throws before yielding
    async function* factory() {
      calls++;
      throw new LlmError("UNKNOWN", "unknown");
    }

    const err = await drainExpectError(service.withRetry(factory));
    expect(err.code).toBe("UNKNOWN");
    expect(calls).toBe(1);
  });

  it("throws after max 3 attempts", async () => {
    let calls = 0;
    // biome-ignore lint/correctness/useYield: intentionally throws before yielding
    async function* factory() {
      calls++;
      throw new LlmError("RATE_LIMITED", "rate limited");
    }

    const err = await drainExpectError(service.withRetry(factory));
    expect(err.code).toBe("RATE_LIMITED");
    expect(calls).toBe(3);
  });

  it("uses exponential backoff delays", async () => {
    let calls = 0;
    const callTimes: number[] = [];

    async function* factory() {
      calls++;
      callTimes.push(Date.now());
      if (calls < 3) {
        throw new LlmError("TIMEOUT", "timeout");
      }
      yield "ok";
    }

    const gen = service.withRetry(factory);
    const tokens: string[] = [];
    let done = false;

    const promise = (async () => {
      for await (const t of gen) {
        tokens.push(t);
      }
      done = true;
    })();

    while (!done) {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    }
    await promise;

    expect(calls).toBe(3);
    const delay1 = callTimes[1] - callTimes[0];
    const delay2 = callTimes[2] - callTimes[1];
    expect(delay1).toBe(1000);
    expect(delay2).toBe(2000);
  });

  it("does not retry non-LlmError", async () => {
    let calls = 0;
    // biome-ignore lint/correctness/useYield: intentionally throws before yielding
    async function* factory() {
      calls++;
      throw new Error("random failure");
    }

    let caught: Error | undefined;
    try {
      const gen = service.withRetry(factory);
      for await (const _ of gen) {
        /* consume */
      }
    } catch (e) {
      caught = e as Error;
    }
    expect(caught?.message).toBe("random failure");
    expect(calls).toBe(1);
  });
});
