import type {
  MessageAckPayload,
  MessagePayload,
  PresencePayload,
  WsPayload,
} from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { WebSocket } from "ws";
import { buildApp } from "./app";
import { clearAllConnections } from "./services/connections";
import {
  createSession,
  destroySession,
  getAllSessions,
} from "./services/sessions";

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

function waitForMessage(ws: TestSocket): Promise<WsPayload> {
  return new Promise((resolve) => {
    ws.once("message", (data: unknown) => {
      resolve(JSON.parse(String(data)));
    });
  });
}

beforeEach(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(async () => {
  for (const s of getAllSessions()) {
    destroySession(s.id);
  }
  clearAllConnections();
  await app.close();
});

describe("e2e: participant tracking", () => {
  it("joining a session broadcasts presence to the joiner", async () => {
    const session = createSession("test");

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
    const session = createSession("test");

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
    const session = createSession("test");

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
    const session = createSession("test");

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
    const session = createSession("test");
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

    const session = createSession("test");
    const msgPromise = waitForMessage(ws);
    ws.send(joinPayload(session.id, "p1", "Alice"));

    const msg = await msgPromise;
    expect(msg.type).toBe(WsEvent.Presence);

    ws.terminate();
  });
});

describe("e2e: message broadcast", () => {
  async function setupTwoParticipants() {
    const session = createSession("test");
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
    const session = createSession("test");
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
