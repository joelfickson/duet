import type { WebSocket } from "ws";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_MISSED = 3;

let intervalMs =
  Number(process.env.HEARTBEAT_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
let maxMissed = Number(process.env.HEARTBEAT_MAX_MISSED) || DEFAULT_MAX_MISSED;

export function setHeartbeatConfig(interval: number, missed: number): void {
  intervalMs = interval;
  maxMissed = missed;
}

export function getHeartbeatConfig(): {
  intervalMs: number;
  maxMissed: number;
} {
  return { intervalMs, maxMissed };
}

interface HeartbeatState {
  missedPongs: number;
  timer: ReturnType<typeof setInterval>;
}

const heartbeats = new Map<string, HeartbeatState>();

export function startHeartbeat(
  connectionId: string,
  socket: WebSocket,
  onDead: () => void,
): void {
  stopHeartbeat(connectionId);

  const state: HeartbeatState = {
    missedPongs: 0,
    timer: setInterval(() => {
      state.missedPongs++;
      if (state.missedPongs > maxMissed) {
        stopHeartbeat(connectionId);
        onDead();
        return;
      }
      if (socket.readyState === socket.OPEN) {
        socket.ping();
      }
    }, intervalMs),
  };

  heartbeats.set(connectionId, state);

  socket.on("pong", () => {
    const s = heartbeats.get(connectionId);
    if (s) s.missedPongs = 0;
  });
}

export function stopHeartbeat(connectionId: string): void {
  const state = heartbeats.get(connectionId);
  if (state) {
    clearInterval(state.timer);
    heartbeats.delete(connectionId);
  }
}

export function clearAllHeartbeats(): void {
  for (const state of heartbeats.values()) {
    clearInterval(state.timer);
  }
  heartbeats.clear();
}
