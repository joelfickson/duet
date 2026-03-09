import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

export interface Connection {
  id: string;
  socket: WebSocket;
  connectedAt: string;
  sessionId: string | null;
  participantId: string | null;
}

export default class ConnectionService {
  private connections = new Map<string, Connection>();
  private sessionConnections = new Map<string, Set<string>>();
  private connectionSession = new Map<string, string>();

  add(socket: WebSocket): Connection {
    const connection: Connection = {
      id: randomUUID(),
      socket,
      connectedAt: new Date().toISOString(),
      sessionId: null,
      participantId: null,
    };
    this.connections.set(connection.id, connection);
    return connection;
  }

  remove(id: string): void {
    const conn = this.connections.get(id);
    if (conn?.sessionId) {
      this.unmapFromSession(id);
    }
    this.connections.delete(id);
  }

  get(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  getAll(): Map<string, Connection> {
    return this.connections;
  }

  mapToSession(
    connectionId: string,
    sessionId: string,
    participantId: string,
  ): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.sessionId = sessionId;
    conn.participantId = participantId;
    this.connectionSession.set(connectionId, sessionId);

    let connSet = this.sessionConnections.get(sessionId);
    if (!connSet) {
      connSet = new Set();
      this.sessionConnections.set(sessionId, connSet);
    }
    connSet.add(connectionId);
  }

  unmapFromSession(connectionId: string): void {
    const sessionId = this.connectionSession.get(connectionId);
    if (!sessionId) return;

    this.connectionSession.delete(connectionId);

    const connSet = this.sessionConnections.get(sessionId);
    if (connSet) {
      connSet.delete(connectionId);
      if (connSet.size === 0) {
        this.sessionConnections.delete(sessionId);
      }
    }

    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.sessionId = null;
      conn.participantId = null;
    }
  }

  getForSession(sessionId: string): Connection[] {
    const connSet = this.sessionConnections.get(sessionId);
    if (!connSet) return [];

    const result: Connection[] = [];
    for (const connId of connSet) {
      const conn = this.connections.get(connId);
      if (conn) result.push(conn);
    }
    return result;
  }

  getSessionForConnection(connectionId: string): string | null {
    return this.connectionSession.get(connectionId) ?? null;
  }

  clearAll(): void {
    this.connections.clear();
    this.sessionConnections.clear();
    this.connectionSession.clear();
  }
}
