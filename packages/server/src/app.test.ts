import type {
  HistoryPayload,
  MessageAckPayload,
  MessagePayload,
  PresencePayload,
  TypingPayload,
  WsPayload,
} from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { buildApp } from "./app";

type App = Awaited<ReturnType<typeof buildApp>>;
type TestSocket = WebSocket & { terminate(): void };
let app: App;

async function injectWS(): Promise<TestSocket> {
  return (await app.injectWS("/ws")) as unknown as TestSocket;
}

function joinPayload(sessionId: string, id: string, name: string): string {
  return JSON.stringify({
    type: WsEvent.Join,
    sessionId,
    participant: { id, name, connectedAt: new Date().toISOString() },
  });
}

function leavePayload(sessionId: string, participantId: string): string {
  return JSON.stringify({
    type: WsEvent.Leave,
    sessionId,
    participantId,
  });
}

function messagePayload(
  sessionId: string,
  senderId: string,
  senderName: string,
  content: string,
): string {
  return JSON.stringify({
    type: WsEvent.Message,
    message: {
      id: "",
      sessionId,
      senderId,
      senderName,
      content,
      role: "user",
      createdAt: "",
    },
  });
}

function typingPayload(
  sessionId: string,
  participantId: string,
  isTyping: boolean,
): string {
  return JSON.stringify({
    type: WsEvent.Typing,
    sessionId,
    participantId,
    isTyping,
  });
}

function reconnectPayload(sessionId: string, participantId: string): string {
  return JSON.stringify({
    type: WsEvent.Reconnect,
    sessionId,
    participantId,
  });
}

function waitForMessage(ws: TestSocket): Promise<WsPayload> {
  return new Promise((resolve) => {
    ws.once("message", (data: unknown) => {
      resolve(JSON.parse(String(data)));
    });
  });
}

beforeEach(async () => {
  app = await buildApp({ logger: false, skipMigrations: true });
  await app.ready();
});

afterEach(async () => {
  for (const s of app.sessionService.getAll()) {
    app.sessionService.destroy(s.id);
  }
  app.connectionService.clearAll();
  app.typingService.clearAll();
  app.heartbeatService.clearAll();
  app.reconnectionService.clearAll();
  app.rateLimitService.clearAll();
  await app.close();
});

describe("e2e: participant tracking", () => {
  it("joining a session broadcasts presence to the joiner", async () => {
    const session = app.sessionService.create("test");

    const ws = await injectWS();

    const msgPromise = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));

    const msg = await msgPromise;
    expect(msg.type).toBe(WsEvent.Presence);
    const presence = msg as PresencePayload;
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].name).toBe("Alice");

    ws.terminate();
  });

  it("second participant join broadcasts presence to first participant", async () => {
    const session = app.sessionService.create("test");

    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const presencePromise = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));

    const msg = await presencePromise;
    expect(msg.type).toBe(WsEvent.Presence);
    const presence = msg as PresencePayload;
    expect(presence.participants).toHaveLength(2);
    const names = presence.participants.map((p) => p.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Bob");

    ws1.terminate();
    ws2.terminate();
  });

  it("disconnecting broadcasts updated presence to remaining members", async () => {
    const session = app.sessionService.create("test");

    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const bobJoinPromise = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await bobJoinPromise;

    const leavePromise = waitForMessage(ws1);
    ws2.terminate();

    const msg = await leavePromise;
    expect(msg.type).toBe(WsEvent.Presence);
    const presence = msg as PresencePayload;
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].name).toBe("Alice");

    ws1.terminate();
  });

  it("explicit leave event removes participant and broadcasts", async () => {
    const session = app.sessionService.create("test");

    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const bobJoinPromise = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await bobJoinPromise;

    const leavePromise = waitForMessage(ws1);
    ws2.send(leavePayload(session.id, "p2"));

    const msg = await leavePromise;
    expect(msg.type).toBe(WsEvent.Presence);
    const presence = msg as PresencePayload;
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].name).toBe("Alice");

    ws1.terminate();
    ws2.terminate();
  });

  it("joining a nonexistent session returns an error", async () => {
    const ws = await injectWS();

    const msgPromise = waitForMessage(ws);
    ws.send(joinPayload("nonexistent", "p1", "Alice"));

    const msg = await msgPromise;
    expect(msg.type).toBe(WsEvent.Error);
    expect((msg as { code: string }).code).toBe("SESSION_NOT_FOUND");

    ws.terminate();
  });

  it("supports many participants in the same session", async () => {
    const session = app.sessionService.create("test");
    const sockets: TestSocket[] = [];
    const count = 10;

    for (let i = 0; i < count; i++) {
      const ws = await injectWS();
      sockets.push(ws);
    }

    for (let i = 0; i < count; i++) {
      const promises = sockets.slice(0, i).map((ws) => waitForMessage(ws));

      sockets[i].send(joinPayload(session.id, `p${i}`, `User${i}`));
      const selfPresence = await waitForMessage(sockets[i]);

      expect(selfPresence.type).toBe(WsEvent.Presence);
      expect((selfPresence as PresencePayload).participants).toHaveLength(
        i + 1,
      );

      await Promise.all(promises);
    }

    for (const ws of sockets) {
      ws.terminate();
    }
  });

  it("invalid JSON is ignored without crashing", async () => {
    const ws = await injectWS();
    ws.send("not json at all");

    const session = app.sessionService.create("test");
    const msgPromise = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));

    const msg = await msgPromise;
    expect(msg.type).toBe(WsEvent.Presence);

    ws.terminate();
  });
});

describe("e2e: message broadcast", () => {
  async function setupTwoParticipants() {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1PresencePromise = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);
    await p1PresencePromise;

    return { session, ws1, ws2 };
  }

  it("sender receives ack with assigned message ID", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();

    const ackPromise = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Hello everyone"));

    const ack = (await ackPromise) as MessageAckPayload;
    expect(ack.type).toBe(WsEvent.MessageAck);
    expect(ack.messageId).toBeTruthy();
    expect(ack.sessionId).toBe(session.id);
    expect(ack.createdAt).toBeTruthy();

    ws1.terminate();
    ws2.terminate();
  });

  it("message is broadcast to other participants but not sender", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();

    const broadcastPromise = waitForMessage(ws2);
    const ackPromise = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Hello everyone"));

    const broadcast = (await broadcastPromise) as MessagePayload;
    expect(broadcast.type).toBe(WsEvent.Message);
    expect(broadcast.message.content).toBe("Hello everyone");
    expect(broadcast.message.senderId).toBe("p1");
    expect(broadcast.message.senderName).toBe("Alice");
    expect(broadcast.message.sessionId).toBe(session.id);
    expect(broadcast.message.role).toBe("user");
    expect(broadcast.message.id).toBeTruthy();
    expect(broadcast.message.createdAt).toBeTruthy();

    const ack = await ackPromise;
    expect(ack.type).toBe(WsEvent.MessageAck);

    ws1.terminate();
    ws2.terminate();
  });

  it("message from unjoined connection is dropped", async () => {
    const session = app.sessionService.create("test");
    const ws = await injectWS();

    ws.send(messagePayload(session.id, "p1", "Alice", "Hello"));

    const joinPromise = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));
    const msg = await joinPromise;
    expect(msg.type).toBe(WsEvent.Presence);

    ws.terminate();
  });

  it("empty message content returns error", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();

    const errorPromise = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", ""));

    const error = await errorPromise;
    expect(error.type).toBe(WsEvent.Error);
    expect((error as { code: string }).code).toBe("INVALID_MESSAGE");

    ws1.terminate();
    ws2.terminate();
  });

  it("whitespace-only message content returns error", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();

    const errorPromise = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "   "));

    const error = await errorPromise;
    expect(error.type).toBe(WsEvent.Error);
    expect((error as { code: string }).code).toBe("INVALID_MESSAGE");

    ws1.terminate();
    ws2.terminate();
  });

  it("message broadcasts to multiple participants", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();
    const ws3 = await injectWS();

    const p1Promise = waitForMessage(ws1);
    const p2Promise = waitForMessage(ws2);
    ws3.send(joinPayload(session.id, "p3", "Charlie"));
    await waitForMessage(ws3);
    await p1Promise;
    await p2Promise;

    const p2MsgPromise = waitForMessage(ws2);
    const p3MsgPromise = waitForMessage(ws3);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Hello all"));

    const [p2Msg, p3Msg] = await Promise.all([p2MsgPromise, p3MsgPromise]);

    expect(p2Msg.type).toBe(WsEvent.Message);
    expect((p2Msg as MessagePayload).message.content).toBe("Hello all");
    expect(p3Msg.type).toBe(WsEvent.Message);
    expect((p3Msg as MessagePayload).message.content).toBe("Hello all");

    ws1.terminate();
    ws2.terminate();
    ws3.terminate();
  });

  it("message after sender disconnects is dropped gracefully", async () => {
    const { session, ws1, ws2 } = await setupTwoParticipants();

    ws1.terminate();
    await waitForMessage(ws2);

    const ws3 = await injectWS();
    ws3.send(messagePayload(session.id, "p1", "Alice", "Ghost message"));

    const joinPromise = waitForMessage(ws3);
    ws3.send(joinPayload(session.id, "p3", "Charlie"));
    const msg = await joinPromise;
    expect(msg.type).toBe(WsEvent.Presence);

    ws2.terminate();
    ws3.terminate();
  });
});

describe("e2e: presence system", () => {
  it("join broadcasts presence with full participant list", async () => {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();

    const msg = waitForMessage(ws1);
    ws1.send(joinPayload(session.id, "p1", "Alice"));

    const presence = (await msg) as PresencePayload;
    expect(presence.type).toBe(WsEvent.Presence);
    expect(presence.sessionId).toBe(session.id);
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].id).toBe("p1");

    ws1.terminate();
  });

  it("second join broadcasts updated list to all participants", async () => {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1Promise = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);

    const presence = (await p1Promise) as PresencePayload;
    expect(presence.type).toBe(WsEvent.Presence);
    expect(presence.participants).toHaveLength(2);
    expect(presence.participants.map((p) => p.id)).toContain("p1");
    expect(presence.participants.map((p) => p.id)).toContain("p2");

    ws1.terminate();
    ws2.terminate();
  });

  it("leave broadcasts updated list to remaining participants", async () => {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1Join2 = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);
    await p1Join2;

    const leavePresence = waitForMessage(ws1);
    ws2.send(leavePayload(session.id, "p2"));

    const presence = (await leavePresence) as PresencePayload;
    expect(presence.type).toBe(WsEvent.Presence);
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].id).toBe("p1");

    ws1.terminate();
    ws2.terminate();
  });

  it("disconnect broadcasts updated list to remaining participants", async () => {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1Join2 = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);
    await p1Join2;

    const leavePresence = waitForMessage(ws1);
    ws2.terminate();

    const presence = (await leavePresence) as PresencePayload;
    expect(presence.type).toBe(WsEvent.Presence);
    expect(presence.participants).toHaveLength(1);
    expect(presence.participants[0].id).toBe("p1");

    ws1.terminate();
  });

  it("presence events use shared types", async () => {
    const session = app.sessionService.create("test");
    const ws = await injectWS();

    const msg = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));

    const presence = (await msg) as PresencePayload;
    expect(presence).toHaveProperty("type");
    expect(presence).toHaveProperty("sessionId");
    expect(presence).toHaveProperty("participants");
    expect(presence.participants[0]).toHaveProperty("id");
    expect(presence.participants[0]).toHaveProperty("name");
    expect(presence.participants[0]).toHaveProperty("connectedAt");

    ws.terminate();
  });
});

describe("e2e: typing indicators", () => {
  async function setupTwoJoined() {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1Presence = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);
    await p1Presence;

    return { session, ws1, ws2 };
  }

  it("typing:start broadcasts to other participants", async () => {
    const { session, ws1, ws2 } = await setupTwoJoined();

    const typingPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", true));

    const msg = (await typingPromise) as TypingPayload;
    expect(msg.type).toBe(WsEvent.Typing);
    expect(msg.sessionId).toBe(session.id);
    expect(msg.participantId).toBe("p1");
    expect(msg.isTyping).toBe(true);

    ws1.terminate();
    ws2.terminate();
  });

  it("typing:stop broadcasts to other participants", async () => {
    const { session, ws1, ws2 } = await setupTwoJoined();

    const startPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", true));
    await startPromise;

    const stopPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", false));

    const msg = (await stopPromise) as TypingPayload;
    expect(msg.type).toBe(WsEvent.Typing);
    expect(msg.participantId).toBe("p1");
    expect(msg.isTyping).toBe(false);

    ws1.terminate();
    ws2.terminate();
  });

  it("typing auto-stops after 3 second timeout", async () => {
    const { session, ws1, ws2 } = await setupTwoJoined();

    const startPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", true));
    await startPromise;

    const stopPromise = waitForMessage(ws2);
    const stop = (await stopPromise) as TypingPayload;
    expect(stop.type).toBe(WsEvent.Typing);
    expect(stop.participantId).toBe("p1");
    expect(stop.isTyping).toBe(false);

    ws1.terminate();
    ws2.terminate();
  }, 5000);

  it("typing from unjoined connection is ignored", async () => {
    const session = app.sessionService.create("test");
    const ws = await injectWS();

    ws.send(typingPayload(session.id, "p1", true));

    const joinMsg = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));
    const msg = await joinMsg;
    expect(msg.type).toBe(WsEvent.Presence);

    ws.terminate();
  });

  it("typing is cleared when participant leaves", async () => {
    const { session, ws1, ws2 } = await setupTwoJoined();

    const startPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", true));
    await startPromise;

    const stopPromise = waitForMessage(ws2);
    ws1.send(leavePayload(session.id, "p1"));

    const stop = (await stopPromise) as TypingPayload;
    expect(stop.type).toBe(WsEvent.Typing);
    expect(stop.participantId).toBe("p1");
    expect(stop.isTyping).toBe(false);

    ws1.terminate();
    ws2.terminate();
  });

  it("typing is cleared when participant disconnects", async () => {
    const { ws1, ws2 } = await setupTwoJoined();

    const startPromise = waitForMessage(ws2);
    ws1.send(typingPayload("ignored", "p1", true));
    await startPromise;

    const stopPromise = waitForMessage(ws2);
    ws1.terminate();

    const stop = (await stopPromise) as TypingPayload;
    expect(stop.type).toBe(WsEvent.Typing);
    expect(stop.participantId).toBe("p1");
    expect(stop.isTyping).toBe(false);

    ws2.terminate();
  });

  it("sending a message clears typing state", async () => {
    const { session, ws1, ws2 } = await setupTwoJoined();

    const startPromise = waitForMessage(ws2);
    ws1.send(typingPayload(session.id, "p1", true));
    await startPromise;

    const stopPromise = waitForMessage(ws2);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Hello"));

    const stop = (await stopPromise) as TypingPayload;
    expect(stop.type).toBe(WsEvent.Typing);
    expect(stop.participantId).toBe("p1");
    expect(stop.isTyping).toBe(false);

    ws1.terminate();
    ws2.terminate();
  });
});

describe("e2e: heartbeat", () => {
  it("heartbeat config is configurable", () => {
    app.heartbeatService.setConfig(100, 2);
    const config = app.heartbeatService.getConfig();
    expect(config.intervalMs).toBe(100);
    expect(config.maxMissed).toBe(2);
  });
});

describe("e2e: reconnection", () => {
  async function setupTwoJoined() {
    const session = app.sessionService.create("test");
    const ws1 = await injectWS();
    const ws2 = await injectWS();

    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await waitForMessage(ws1);

    const p1Presence = waitForMessage(ws1);
    ws2.send(joinPayload(session.id, "p2", "Bob"));
    await waitForMessage(ws2);
    await p1Presence;

    return { session, ws1, ws2 };
  }

  it("reconnect within grace period restores participant identity", async () => {
    app.reconnectionService.setGracePeriod(5000);
    const { session, ws1, ws2 } = await setupTwoJoined();

    ws2.terminate();
    await waitForMessage(ws1);

    const ws3 = await injectWS();
    const presencePromise = waitForMessage(ws1);
    ws3.send(reconnectPayload(session.id, "p2"));

    const presence = (await presencePromise) as PresencePayload;
    expect(presence.type).toBe(WsEvent.Presence);
    expect(presence.participants).toHaveLength(2);
    expect(presence.participants.map((p) => p.id)).toContain("p2");

    ws1.terminate();
    ws3.terminate();
  });

  it("reconnect after grace period expires returns error", async () => {
    app.reconnectionService.setGracePeriod(50);
    const { session, ws1, ws2 } = await setupTwoJoined();

    ws2.terminate();
    await waitForMessage(ws1);

    await new Promise((r) => setTimeout(r, 100));

    const ws3 = await injectWS();
    const errorPromise = waitForMessage(ws3);
    ws3.send(reconnectPayload(session.id, "p2"));

    const error = await errorPromise;
    expect(error.type).toBe(WsEvent.Error);
    expect((error as { code: string }).code).toBe("RECONNECT_FAILED");

    ws1.terminate();
    ws3.terminate();
  });

  it("reconnecting participant receives missed messages", async () => {
    app.reconnectionService.setGracePeriod(5000);
    const { session, ws1, ws2 } = await setupTwoJoined();

    ws2.terminate();
    await waitForMessage(ws1);

    const ack1 = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Message while away 1"));
    await ack1;

    const ack2 = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "Message while away 2"));
    await ack2;

    const ws3 = await injectWS();
    const received: WsPayload[] = [];
    const done = new Promise<void>((resolve) => {
      ws3.on("message", (data: unknown) => {
        const parsed = JSON.parse(String(data)) as WsPayload;
        received.push(parsed);
        if (parsed.type === WsEvent.Presence) resolve();
      });
    });
    ws3.send(reconnectPayload(session.id, "p2"));
    await done;

    const messages = received.filter(
      (m) => m.type === WsEvent.Message,
    ) as MessagePayload[];
    expect(messages).toHaveLength(2);
    expect(messages[0].message.content).toBe("Message while away 1");
    expect(messages[1].message.content).toBe("Message while away 2");

    const presences = received.filter(
      (m) => m.type === WsEvent.Presence,
    ) as PresencePayload[];
    expect(presences).toHaveLength(1);
    expect(presences[0].participants).toHaveLength(2);

    ws1.terminate();
    ws3.terminate();
  });

  it("reconnect to nonexistent participant returns error", async () => {
    const session = app.sessionService.create("test");
    const ws = await injectWS();

    const errorPromise = waitForMessage(ws);
    ws.send(reconnectPayload(session.id, "nobody"));

    const error = await errorPromise;
    expect(error.type).toBe(WsEvent.Error);
    expect((error as { code: string }).code).toBe("RECONNECT_FAILED");

    ws.terminate();
  });
});

function collectMessages(ws: TestSocket, count: number): Promise<WsPayload[]> {
  return new Promise((resolve) => {
    const results: WsPayload[] = [];
    ws.on("message", (data: unknown) => {
      results.push(JSON.parse(String(data)));
      if (results.length === count) resolve(results);
    });
  });
}

describe("e2e: history on join", () => {
  it("new participant receives message history on join", async () => {
    const session = app.sessionService.create("test");

    const ws1 = await injectWS();
    const presence1 = waitForMessage(ws1);
    ws1.send(joinPayload(session.id, "p1", "Alice"));
    await presence1;

    const ack1 = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "hello world"));
    await ack1;

    const ack2 = waitForMessage(ws1);
    ws1.send(messagePayload(session.id, "p1", "Alice", "second message"));
    await ack2;

    const ws2 = await injectWS();
    const ws2Messages = collectMessages(ws2, 2);
    ws2.send(joinPayload(session.id, "p2", "Bob"));

    const received = await ws2Messages;
    const history = received.find(
      (m) => m.type === WsEvent.History,
    ) as HistoryPayload;
    expect(history).toBeDefined();
    expect(history.messages).toHaveLength(2);
    expect(history.messages[0].content).toBe("hello world");
    expect(history.messages[1].content).toBe("second message");

    ws1.terminate();
    ws2.terminate();
  });

  it("first participant joining an empty session receives no history event", async () => {
    const session = app.sessionService.create("test");

    const ws = await injectWS();
    const msg = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));

    const received = await msg;
    expect(received.type).toBe(WsEvent.Presence);

    ws.terminate();
  });
});
