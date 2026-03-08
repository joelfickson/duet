import type { WsPayload } from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { getConnectionsForSession } from "./connections";
import { getParticipants } from "./sessions";

export function broadcastToSession(
  sessionId: string,
  payload: WsPayload,
  excludeConnectionId?: string,
): void {
  const msg = JSON.stringify(payload);
  for (const conn of getConnectionsForSession(sessionId)) {
    if (conn.id === excludeConnectionId) continue;
    if (conn.socket.readyState === conn.socket.OPEN) {
      conn.socket.send(msg);
    }
  }
}

export function broadcastPresence(sessionId: string): void {
  const participants = getParticipants(sessionId);
  const payload: WsPayload = {
    type: WsEvent.Presence,
    sessionId,
    participants,
  };
  broadcastToSession(sessionId, payload);
}
