import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";

export interface Connection {
  id: string;
  socket: WebSocket;
  connectedAt: string;
}

const connections = new Map<string, Connection>();

export function addConnection(socket: WebSocket): Connection {
  const connection: Connection = {
    id: randomUUID(),
    socket,
    connectedAt: new Date().toISOString(),
  };
  connections.set(connection.id, connection);
  return connection;
}

export function removeConnection(id: string): void {
  connections.delete(id);
}

export function getConnection(id: string): Connection | undefined {
  return connections.get(id);
}

export function getAllConnections(): Map<string, Connection> {
  return connections;
}
