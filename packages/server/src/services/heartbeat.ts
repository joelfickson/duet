import type { WebSocket } from "ws";

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MAX_MISSED = 3;

interface HeartbeatState {
  missedPongs: number;
  timer: ReturnType<typeof setInterval>;
}

export default class HeartbeatService {
  private heartbeats = new Map<string, HeartbeatState>();
  private intervalMs =
    Number(process.env.HEARTBEAT_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  private maxMissed =
    Number(process.env.HEARTBEAT_MAX_MISSED) || DEFAULT_MAX_MISSED;

  setConfig(interval: number, missed: number): void {
    this.intervalMs = interval;
    this.maxMissed = missed;
  }

  getConfig(): { intervalMs: number; maxMissed: number } {
    return { intervalMs: this.intervalMs, maxMissed: this.maxMissed };
  }

  start(connectionId: string, socket: WebSocket, onDead: () => void): void {
    this.stop(connectionId);

    const state: HeartbeatState = {
      missedPongs: 0,
      timer: setInterval(() => {
        state.missedPongs++;
        if (state.missedPongs > this.maxMissed) {
          this.stop(connectionId);
          onDead();
          return;
        }
        if (socket.readyState === socket.OPEN) {
          socket.ping();
        }
      }, this.intervalMs),
    };

    this.heartbeats.set(connectionId, state);

    socket.on("pong", () => {
      const s = this.heartbeats.get(connectionId);
      if (s) s.missedPongs = 0;
    });
  }

  stop(connectionId: string): void {
    const state = this.heartbeats.get(connectionId);
    if (state) {
      clearInterval(state.timer);
      this.heartbeats.delete(connectionId);
    }
  }

  clearAll(): void {
    for (const state of this.heartbeats.values()) {
      clearInterval(state.timer);
    }
    this.heartbeats.clear();
  }
}
