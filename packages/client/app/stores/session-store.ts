import type {
  AiChunkPayload,
  AiDonePayload,
  AiErrorPayload,
  ErrorPayload,
  HistoryPayload,
  Message,
  MessageAckPayload,
  MessagePayload,
  Participant,
  PresencePayload,
  ReplyTo,
  TypingPayload,
  WsPayload,
} from "@duet/shared";
import { WsEvent } from "@duet/shared";
import { create } from "zustand";
import { config } from "~/lib/config";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface SessionStore {
  sessionId: string | null;
  participantId: string | null;
  displayName: string | null;
  status: ConnectionStatus;
  participants: Participant[];
  messages: Message[];
  typingParticipants: Set<string>;
  aiStreamingContent: string;
  isAiStreaming: boolean;
  aiError: string | null;
  error: string | null;
  replyTo: ReplyTo | null;

  connect: (
    sessionId: string,
    participantId: string,
    displayName: string,
  ) => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  sendTyping: (isTyping: boolean) => void;
  setReplyTo: (replyTo: ReplyTo | null) => void;
}

let socket: WebSocket | null = null;

function send(payload: WsPayload) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionId: null,
  participantId: null,
  displayName: null,
  status: "disconnected",
  participants: [],
  messages: [],
  typingParticipants: new Set(),
  aiStreamingContent: "",
  isAiStreaming: false,
  aiError: null,
  error: null,
  replyTo: null,

  connect: (sessionId, participantId, displayName) => {
    const state = get();
    if (state.status === "connecting" || state.status === "connected") return;

    set({
      sessionId,
      participantId,
      displayName,
      status: "connecting",
      participants: [],
      messages: [],
      typingParticipants: new Set(),
      aiStreamingContent: "",
      isAiStreaming: false,
      aiError: null,
      error: null,
    });

    socket = new WebSocket(`${config.wsUrl}/ws`);

    socket.onopen = () => {
      set({ status: "connected" });
      send({
        type: WsEvent.Join,
        sessionId,
        participant: {
          id: participantId,
          name: displayName,
          connectedAt: new Date().toISOString(),
        },
      });
    };

    socket.onmessage = (event) => {
      const data: WsPayload = JSON.parse(event.data as string);
      const store = get();

      switch (data.type) {
        case WsEvent.Presence: {
          const payload = data as PresencePayload;
          set({ participants: payload.participants });
          break;
        }
        case WsEvent.History: {
          const payload = data as HistoryPayload;
          set({ messages: payload.messages });
          break;
        }
        case WsEvent.Message: {
          const payload = data as MessagePayload;
          set({ messages: [...store.messages, payload.message] });
          break;
        }
        case WsEvent.MessageAck: {
          const payload = data as MessageAckPayload;
          set({
            messages: store.messages.map((m) =>
              m.id === payload.messageId
                ? { ...m, createdAt: payload.createdAt }
                : m,
            ),
          });
          break;
        }
        case WsEvent.Typing: {
          const payload = data as TypingPayload;
          const next = new Set(store.typingParticipants);
          if (payload.isTyping) {
            next.add(payload.participantId);
          } else {
            next.delete(payload.participantId);
          }
          set({ typingParticipants: next });
          break;
        }
        case WsEvent.AiChunk: {
          const payload = data as AiChunkPayload;
          set({
            isAiStreaming: true,
            aiError: null,
            aiStreamingContent: store.aiStreamingContent + payload.token,
          });
          break;
        }
        case WsEvent.AiDone: {
          const payload = data as AiDonePayload;
          set({
            isAiStreaming: false,
            aiStreamingContent: "",
            messages: [...store.messages, payload.message],
          });
          break;
        }
        case WsEvent.AiError: {
          const payload = data as AiErrorPayload;
          set({
            isAiStreaming: false,
            aiStreamingContent: "",
            aiError: payload.message,
          });
          break;
        }
        case WsEvent.Error: {
          const payload = data as ErrorPayload;
          set({ error: payload.message });
          break;
        }
      }
    };

    socket.onclose = () => {
      socket = null;
      set({ status: "disconnected" });
    };

    socket.onerror = () => {
      set({ status: "error", error: "Connection lost" });
    };
  },

  disconnect: () => {
    const state = get();
    if (socket && state.sessionId && state.participantId) {
      send({
        type: WsEvent.Leave,
        sessionId: state.sessionId,
        participantId: state.participantId,
      });
    }
    socket?.close();
    socket = null;
    set({
      status: "disconnected",
      sessionId: null,
      participantId: null,
      displayName: null,
    });
  },

  sendMessage: (content) => {
    const state = get();
    if (!state.sessionId || !state.participantId || !state.displayName) return;

    const tempId = crypto.randomUUID();
    const message: Message = {
      id: tempId,
      sessionId: state.sessionId,
      senderId: state.participantId,
      senderName: state.displayName,
      content,
      role: "user",
      createdAt: new Date().toISOString(),
    };
    if (state.replyTo) {
      message.replyTo = state.replyTo;
    }

    set({ messages: [...state.messages, message], replyTo: null });

    send({
      type: WsEvent.Message,
      message,
    });

    if (state.typingParticipants.has(state.participantId)) {
      send({
        type: WsEvent.Typing,
        sessionId: state.sessionId,
        participantId: state.participantId,
        isTyping: false,
      });
    }
  },

  sendTyping: (isTyping) => {
    const state = get();
    if (!state.sessionId || !state.participantId) return;
    send({
      type: WsEvent.Typing,
      sessionId: state.sessionId,
      participantId: state.participantId,
      isTyping,
    });
  },

  setReplyTo: (replyTo) => {
    set({ replyTo });
  },
}));
