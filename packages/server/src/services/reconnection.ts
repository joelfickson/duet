import type { Message, Participant } from "@duet/shared";

const DEFAULT_GRACE_PERIOD_MS = 60_000;

interface DisconnectedParticipant {
  participant: Participant;
  sessionId: string;
  missedMessages: Message[];
  timer: ReturnType<typeof setTimeout>;
}

export interface ReconnectResult {
  participant: Participant;
  missedMessages: Message[];
}

export default class ReconnectionService {
  private disconnected = new Map<string, DisconnectedParticipant>();
  private gracePeriodMs =
    Number(process.env.RECONNECT_GRACE_MS) || DEFAULT_GRACE_PERIOD_MS;

  setGracePeriod(ms: number): void {
    this.gracePeriodMs = ms;
  }

  stash(sessionId: string, participant: Participant): void {
    const k = this.key(sessionId, participant.id);
    const existing = this.disconnected.get(k);
    if (existing) clearTimeout(existing.timer);

    this.disconnected.set(k, {
      participant,
      sessionId,
      missedMessages: [],
      timer: setTimeout(() => {
        this.disconnected.delete(k);
      }, this.gracePeriodMs),
    });
  }

  bufferMessage(sessionId: string, message: Message): void {
    for (const [k, entry] of this.disconnected) {
      if (k.startsWith(`${sessionId}:`) && entry.sessionId === sessionId) {
        entry.missedMessages.push(message);
      }
    }
  }

  tryReconnect(
    sessionId: string,
    participantId: string,
  ): ReconnectResult | null {
    const k = this.key(sessionId, participantId);
    const entry = this.disconnected.get(k);
    if (!entry) return null;

    clearTimeout(entry.timer);
    this.disconnected.delete(k);

    return {
      participant: entry.participant,
      missedMessages: entry.missedMessages,
    };
  }

  clearAll(): void {
    for (const entry of this.disconnected.values()) {
      clearTimeout(entry.timer);
    }
    this.disconnected.clear();
  }

  private key(sessionId: string, participantId: string): string {
    return `${sessionId}:${participantId}`;
  }
}
