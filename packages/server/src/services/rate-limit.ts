const DEFAULT_MAX_MESSAGES = 30;
const DEFAULT_WINDOW_MS = 10_000;

export default class RateLimitService {
  private timestamps = new Map<string, number[]>();
  private _maxMessages =
    Number(process.env.RATE_LIMIT_MAX) || DEFAULT_MAX_MESSAGES;
  private _windowMs =
    Number(process.env.RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;

  setConfig(maxMessages: number, windowMs: number): void {
    this._maxMessages = maxMessages;
    this._windowMs = windowMs;
  }

  getConfig(): { maxMessages: number; windowMs: number } {
    return { maxMessages: this._maxMessages, windowMs: this._windowMs };
  }

  isLimited(connectionId: string): boolean {
    const now = Date.now();
    const cutoff = now - this._windowMs;

    let entries = this.timestamps.get(connectionId);
    if (!entries) {
      entries = [];
      this.timestamps.set(connectionId, entries);
    }

    while (entries.length > 0 && entries[0] <= cutoff) {
      entries.shift();
    }

    if (entries.length >= this._maxMessages) {
      return true;
    }

    entries.push(now);
    return false;
  }

  clear(connectionId: string): void {
    this.timestamps.delete(connectionId);
  }

  clearAll(): void {
    this.timestamps.clear();
  }
}
