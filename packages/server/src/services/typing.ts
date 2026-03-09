const TYPING_TIMEOUT_MS = 3000;

export default class TypingService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  set(sessionId: string, participantId: string, onTimeout: () => void): void {
    const k = this.key(sessionId, participantId);
    const existing = this.timers.get(k);
    if (existing) clearTimeout(existing);

    this.timers.set(
      k,
      setTimeout(() => {
        this.timers.delete(k);
        onTimeout();
      }, TYPING_TIMEOUT_MS),
    );
  }

  clear(sessionId: string, participantId: string): void {
    const k = this.key(sessionId, participantId);
    const timer = this.timers.get(k);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(k);
    }
  }

  isTyping(sessionId: string, participantId: string): boolean {
    return this.timers.has(this.key(sessionId, participantId));
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private key(sessionId: string, participantId: string): string {
    return `${sessionId}:${participantId}`;
  }
}
