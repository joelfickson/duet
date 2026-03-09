import { LlmError, type LlmErrorCode } from "./providers";

const TRANSIENT_CODES: Set<LlmErrorCode> = new Set([
  "RATE_LIMITED",
  "OVERLOADED",
  "TIMEOUT",
]);

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
const MAX_TOTAL_MS = 60_000;

function isTransient(error: unknown): error is LlmError {
  return error instanceof LlmError && TRANSIENT_CODES.has(error.code);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default class RetryService {
  async *withRetry<T>(factory: () => AsyncGenerator<T>): AsyncGenerator<T> {
    const startTime = Date.now();
    let attempt = 0;

    while (true) {
      try {
        yield* factory();
        return;
      } catch (error) {
        attempt++;

        if (!isTransient(error) || attempt >= MAX_ATTEMPTS) {
          throw error;
        }

        const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
        const elapsed = Date.now() - startTime;

        if (elapsed + backoff > MAX_TOTAL_MS) {
          throw error;
        }

        await delay(backoff);
      }
    }
  }
}
