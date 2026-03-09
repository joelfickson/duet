import { randomBytes } from "node:crypto";
import type { Participant, Session, SessionState } from "@duet/shared";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ID_LENGTH = 10;
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_VALID = 256 - (256 % ALPHABET.length);

interface ServerSessionState extends SessionState {
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export default class SessionService {
  private sessions = new Map<string, ServerSessionState>();
  private _idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;

  setIdleTimeout(ms: number): void {
    this._idleTimeoutMs = ms;
  }

  generateSessionId(): string {
    let id = "";
    while (id.length < ID_LENGTH) {
      const bytes = randomBytes(ID_LENGTH);
      for (const byte of bytes) {
        if (byte < MAX_VALID && id.length < ID_LENGTH) {
          id += ALPHABET[byte % ALPHABET.length];
        }
      }
    }
    return id;
  }

  create(title?: string): Session {
    const session: Session = {
      id: this.generateUniqueId(),
      title: title ?? null,
      createdAt: new Date().toISOString(),
      participants: [],
    };
    this.sessions.set(session.id, { session, idleTimer: null });
    this.resetIdleTimer(session.id);
    return session;
  }

  join(sessionId: string, participant: Participant): Session | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;

    const existing = state.session.participants.find(
      (p) => p.id === participant.id,
    );
    if (!existing) {
      state.session.participants.push(participant);
    }

    this.resetIdleTimer(sessionId);
    return state.session;
  }

  leave(sessionId: string, participantId: string): Session | null {
    const state = this.sessions.get(sessionId);
    if (!state) return null;

    state.session.participants = state.session.participants.filter(
      (p) => p.id !== participantId,
    );

    this.resetIdleTimer(sessionId);
    return state.session;
  }

  destroy(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.idleTimer) clearTimeout(state.idleTimer);
    this.sessions.delete(sessionId);
  }

  get(sessionId: string): Session | null {
    return this.sessions.get(sessionId)?.session ?? null;
  }

  getParticipants(sessionId: string): Participant[] {
    return this.sessions.get(sessionId)?.session.participants ?? [];
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values()).map((s) => s.session);
  }

  private generateUniqueId(): string {
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = this.generateSessionId();
      if (!this.sessions.has(id)) return id;
    }
    throw new Error("Failed to generate unique session ID after 10 attempts");
  }

  private resetIdleTimer(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;

    if (state.idleTimer) clearTimeout(state.idleTimer);

    if (state.session.participants.length === 0) {
      state.idleTimer = setTimeout(() => {
        this.destroy(sessionId);
      }, this._idleTimeoutMs);
    } else {
      state.idleTimer = null;
    }
  }
}
