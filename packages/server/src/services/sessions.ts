import { randomBytes } from "node:crypto";
import type { Participant, Session, SessionState } from "@duet/shared";

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface ServerSessionState extends SessionState {
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const sessions = new Map<string, ServerSessionState>();

const ID_LENGTH = 10;
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const MAX_VALID = 256 - (256 % ALPHABET.length);

export function generateSessionId(): string {
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

function generateUniqueSessionId(): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = generateSessionId();
    if (!sessions.has(id)) return id;
  }
  throw new Error("Failed to generate unique session ID after 10 attempts");
}

function resetIdleTimer(sessionId: string): void {
  const state = sessions.get(sessionId);
  if (!state) return;

  if (state.idleTimer) clearTimeout(state.idleTimer);

  if (state.session.participants.length === 0) {
    state.idleTimer = setTimeout(() => {
      destroySession(sessionId);
    }, idleTimeoutMs());
  } else {
    state.idleTimer = null;
  }
}

let _idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;

export function setIdleTimeout(ms: number): void {
  _idleTimeoutMs = ms;
}

function idleTimeoutMs(): number {
  return _idleTimeoutMs;
}

export function createSession(title?: string): Session {
  const session: Session = {
    id: generateUniqueSessionId(),
    title: title ?? null,
    createdAt: new Date().toISOString(),
    participants: [],
  };
  sessions.set(session.id, { session, idleTimer: null });
  resetIdleTimer(session.id);
  return session;
}

export function joinSession(
  sessionId: string,
  participant: Participant,
): Session | null {
  const state = sessions.get(sessionId);
  if (!state) return null;

  const existing = state.session.participants.find(
    (p) => p.id === participant.id,
  );
  if (!existing) {
    state.session.participants.push(participant);
  }

  resetIdleTimer(sessionId);
  return state.session;
}

export function leaveSession(
  sessionId: string,
  participantId: string,
): Session | null {
  const state = sessions.get(sessionId);
  if (!state) return null;

  state.session.participants = state.session.participants.filter(
    (p) => p.id !== participantId,
  );

  resetIdleTimer(sessionId);
  return state.session;
}

export function destroySession(sessionId: string): void {
  const state = sessions.get(sessionId);
  if (!state) return;

  if (state.idleTimer) clearTimeout(state.idleTimer);
  sessions.delete(sessionId);
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId)?.session ?? null;
}

export function getParticipants(sessionId: string): Participant[] {
  return sessions.get(sessionId)?.session.participants ?? [];
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values()).map((s) => s.session);
}
