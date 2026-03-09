import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HeartbeatService from "./heartbeat";

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

describe("HeartbeatService", () => {
  let service: HeartbeatService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new HeartbeatService();
    service.setConfig(100, 2);
  });

  afterEach(() => {
    service.clearAll();
    vi.useRealTimers();
  });

  it("sends pings at the configured interval", () => {
    const socket = fakeSocket();
    service.start("c1", socket as never, vi.fn());

    vi.advanceTimersByTime(100);
    expect(socket.ping).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(socket.ping).toHaveBeenCalledTimes(2);
  });

  it("resets missed count on pong", () => {
    const socket = fakeSocket();
    const onDead = vi.fn();
    service.start("c1", socket as never, onDead);

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
    service.start("c1", socket as never, onDead);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(onDead).toHaveBeenCalledTimes(1);
  });

  it("stop cancels the interval", () => {
    const socket = fakeSocket();
    const onDead = vi.fn();
    service.start("c1", socket as never, onDead);

    service.stop("c1");
    vi.advanceTimersByTime(1000);

    expect(socket.ping).not.toHaveBeenCalled();
    expect(onDead).not.toHaveBeenCalled();
  });
});
