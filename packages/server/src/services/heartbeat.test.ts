import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllHeartbeats,
  setHeartbeatConfig,
  startHeartbeat,
  stopHeartbeat,
} from "./heartbeat";

function fakeSocket() {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    readyState: 1,
    OPEN: 1,
    ping: vi.fn(),
    on(event: string, cb: () => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    _emit(event: string) {
      for (const cb of listeners[event] ?? []) cb();
    },
  };
}

describe("heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHeartbeatConfig(100, 2);
  });

  afterEach(() => {
    clearAllHeartbeats();
    vi.useRealTimers();
  });

  it("sends pings at the configured interval", () => {
    const socket = fakeSocket();
    startHeartbeat("c1", socket as never, vi.fn());

    vi.advanceTimersByTime(100);
    expect(socket.ping).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(socket.ping).toHaveBeenCalledTimes(2);
  });

  it("resets missed count on pong", () => {
    const socket = fakeSocket();
    const onDead = vi.fn();
    startHeartbeat("c1", socket as never, onDead);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    socket._emit("pong");

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(onDead).not.toHaveBeenCalled();
  });

  it("calls onDead after exceeding max missed pongs", () => {
    const socket = fakeSocket();
    const onDead = vi.fn();
    startHeartbeat("c1", socket as never, onDead);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(onDead).toHaveBeenCalledTimes(1);
  });

  it("stopHeartbeat cancels the interval", () => {
    const socket = fakeSocket();
    const onDead = vi.fn();
    startHeartbeat("c1", socket as never, onDead);

    stopHeartbeat("c1");
    vi.advanceTimersByTime(1000);

    expect(socket.ping).not.toHaveBeenCalled();
    expect(onDead).not.toHaveBeenCalled();
  });
});
