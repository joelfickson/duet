const DEFAULT_MAX_MESSAGES = 30;
const DEFAULT_WINDOW_MS = 10_000;

let _maxMessages = Number(process.env.RATE_LIMIT_MAX) || DEFAULT_MAX_MESSAGES;
let _windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;

const timestamps = new Map<string, number[]>();

export function setRateLimitConfig(
  maxMessages: number,
  windowMs: number,
): void {
  _maxMessages = maxMessages;
  _windowMs = windowMs;
}

export function getRateLimitConfig(): {
  maxMessages: number;
  windowMs: number;
} {
  return { maxMessages: _maxMessages, windowMs: _windowMs };
}

export function isRateLimited(connectionId: string): boolean {
  const now = Date.now();
  const cutoff = now - _windowMs;

  let entries = timestamps.get(connectionId);
  if (!entries) {
    entries = [];
    timestamps.set(connectionId, entries);
  }

  while (entries.length > 0 && entries[0] <= cutoff) {
    entries.shift();
  }

  if (entries.length >= _maxMessages) {
    return true;
  }

  entries.push(now);
  return false;
}

export function clearRateLimit(connectionId: string): void {
  timestamps.delete(connectionId);
}

export function clearAllRateLimits(): void {
  timestamps.clear();
}
