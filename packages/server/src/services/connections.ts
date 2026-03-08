import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

export interface Connection {
  id: string;
  socket: WebSocket;
  connectedAt: string;
  sessionId: string | null;
  participantId: string | null;
}

const connections = new Map<string, Connection>();
const sessionConnections = new Map<string, Set<string>>();
const connectionSession = new Map<string, string>();

export function addConnection(socket: WebSocket): Connection {
  const connection: Connection = {
    id: randomUUID(),
    socket,
    connectedAt: new Date().toISOString(),
    sessionId: null,
    participantId: null,
  };
  connections.set(connection.id, connection);
  return connection;
}

export function removeConnection(id: string): void {
  const conn = connections.get(id);
  if (conn?.sessionId) {
    unmapConnectionFromSession(id);
  }
  connections.delete(id);
}

export function getConnection(id: string): Connection | undefined {
  return connections.get(id);
}

export function getAllConnections(): Map<string, Connection> {
  return connections;
}

export function mapConnectionToSession(
  connectionId: string,
  sessionId: string,
  participantId: string,
): void {
  const conn = connections.get(connectionId);
  if (!conn) return;

  conn.sessionId = sessionId;
  conn.participantId = participantId;

  connectionSession.set(connectionId, sessionId);

  let connSet = sessionConnections.get(sessionId);
  if (!connSet) {
    connSet = new Set();
    sessionConnections.set(sessionId, connSet);
  }
  connSet.add(connectionId);
}

export function unmapConnectionFromSession(connectionId: string): void {
  const sessionId = connectionSession.get(connectionId);
  if (!sessionId) return;

  connectionSession.delete(connectionId);

  const connSet = sessionConnections.get(sessionId);
  if (connSet) {
    connSet.delete(connectionId);
    if (connSet.size === 0) {
      sessionConnections.delete(sessionId);
    }
  }

  const conn = connections.get(connectionId);
  if (conn) {
    conn.sessionId = null;
    conn.participantId = null;
  }
}

export function getConnectionsForSession(sessionId: string): Connection[] {
  const connSet = sessionConnections.get(sessionId);
  if (!connSet) return [];

  const result: Connection[] = [];
  for (const connId of connSet) {
    const conn = connections.get(connId);
    if (conn) result.push(conn);
  }
  return result;
}

export function getSessionForConnection(connectionId: string): string | null {
  return connectionSession.get(connectionId) ?? null;
}

export function clearAllConnections(): void {
  connections.clear();
  sessionConnections.clear();
  connectionSession.clear();
}
