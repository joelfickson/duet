import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import type ConnectionService from "./connections";
import type SessionService from "./sessions";

export default class BroadcastService {
  constructor(
    private connections: ConnectionService,
    private sessions: SessionService,
  ) {}

  toSession(
    sessionId: string,
    payload: WsPayload,
    excludeConnectionId?: string,
  ): void {
    const msg = JSON.stringify(payload);
    for (const conn of this.connections.getForSession(sessionId)) {
      if (conn.id === excludeConnectionId) continue;
      if (conn.socket.readyState === conn.socket.OPEN) {
        conn.socket.send(msg);
      }
    }
  }

  presence(sessionId: string): void {
    const participants = this.sessions.getParticipants(sessionId);
    const payload: WsPayload = {
      type: WsEvent.Presence,
      sessionId,
      participants,
    };
    this.toSession(sessionId, payload);
  }
}
