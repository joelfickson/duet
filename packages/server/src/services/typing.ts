const TYPING_TIMEOUT_MS = 3000;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function key(sessionId: string, participantId: string): string {
  return `${sessionId}:${participantId}`;
}

export function setTyping(
  sessionId: string,
  participantId: string,
  onTimeout: () => void,
): void {
  const k = key(sessionId, participantId);
  const existing = typingTimers.get(k);
  if (existing) clearTimeout(existing);

  typingTimers.set(
    k,
    setTimeout(() => {
      typingTimers.delete(k);
      onTimeout();
    }, TYPING_TIMEOUT_MS),
  );
}

export function clearTyping(sessionId: string, participantId: string): void {
  const k = key(sessionId, participantId);
  const timer = typingTimers.get(k);
  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(k);
  }
}

export function isTyping(sessionId: string, participantId: string): boolean {
  return typingTimers.has(key(sessionId, participantId));
}

export function clearAllTyping(): void {
  for (const timer of typingTimers.values()) {
    clearTimeout(timer);
  }
  typingTimers.clear();
}
