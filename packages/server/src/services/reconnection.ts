import type { Message, Participant } from "@duet/shared";

const DEFAULT_GRACE_PERIOD_MS = 60_000;

let gracePeriodMs =
  Number(process.env.RECONNECT_GRACE_MS) || DEFAULT_GRACE_PERIOD_MS;

export function setGracePeriod(ms: number): void {
  gracePeriodMs = ms;
}

interface DisconnectedParticipant {
  participant: Participant;
  sessionId: string;
  missedMessages: Message[];
  timer: ReturnType<typeof setTimeout>;
}

const disconnected = new Map<string, DisconnectedParticipant>();

function key(sessionId: string, participantId: string): string {
  return `${sessionId}:${participantId}`;
}

export function stashDisconnected(
  sessionId: string,
  participant: Participant,
): void {
  const k = key(sessionId, participant.id);
  const existing = disconnected.get(k);
  if (existing) clearTimeout(existing.timer);

  disconnected.set(k, {
    participant,
    sessionId,
    missedMessages: [],
    timer: setTimeout(() => {
      disconnected.delete(k);
    }, gracePeriodMs),
  });
}

export function bufferMessage(sessionId: string, message: Message): void {
  for (const [k, entry] of disconnected) {
    if (k.startsWith(`${sessionId}:`) && entry.sessionId === sessionId) {
      entry.missedMessages.push(message);
    }
  }
}

export interface ReconnectResult {
  participant: Participant;
  missedMessages: Message[];
}

export function tryReconnect(
  sessionId: string,
  participantId: string,
): ReconnectResult | null {
  const k = key(sessionId, participantId);
  const entry = disconnected.get(k);
  if (!entry) return null;

  clearTimeout(entry.timer);
  disconnected.delete(k);

  return {
    participant: entry.participant,
    missedMessages: entry.missedMessages,
  };
}

export function clearAllDisconnected(): void {
  for (const entry of disconnected.values()) {
    clearTimeout(entry.timer);
  }
  disconnected.clear();
}
