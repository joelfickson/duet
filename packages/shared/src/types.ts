export interface Participant {
  id: string;
  name: string;
  connectedAt: string;
}

export interface Session {
  id: string;
  title: string | null;
  createdAt: string;
  participants: Participant[];
}

export interface SessionState {
  session: Session;
}

export type MessageRole = "user" | "assistant";

export interface ReplyTo {
  messageId: string;
  content: string;
  senderName: string;
}

export interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  role: MessageRole;
  createdAt: string;
  replyTo?: ReplyTo;
}

export enum WsEvent {
  Join = "join",
  Leave = "leave",
  Message = "message",
  MessageAck = "message-ack",
  Typing = "typing",
  AiChunk = "ai-chunk",
  AiDone = "ai-done",
  AiError = "ai-error",
  Error = "error",
  Presence = "presence",
  Reconnect = "reconnect",
  History = "history",
}

export interface JoinPayload {
  type: WsEvent.Join;
  sessionId: string;
  participant: Participant;
}

export interface LeavePayload {
  type: WsEvent.Leave;
  sessionId: string;
  participantId: string;
}

export interface MessagePayload {
  type: WsEvent.Message;
  message: Message;
}

export interface TypingPayload {
  type: WsEvent.Typing;
  sessionId: string;
  participantId: string;
  isTyping: boolean;
}

export interface AiChunkPayload {
  type: WsEvent.AiChunk;
  sessionId: string;
  token: string;
  seq: number;
}

export interface AiDonePayload {
  type: WsEvent.AiDone;
  sessionId: string;
  message: Message;
}

export interface AiErrorPayload {
  type: WsEvent.AiError;
  sessionId: string;
  code: string;
  message: string;
}

export interface ErrorPayload {
  type: WsEvent.Error;
  code: string;
  message: string;
}

export interface PresencePayload {
  type: WsEvent.Presence;
  sessionId: string;
  participants: Participant[];
}

export interface MessageAckPayload {
  type: WsEvent.MessageAck;
  messageId: string;
  sessionId: string;
  createdAt: string;
}

export interface ReconnectPayload {
  type: WsEvent.Reconnect;
  sessionId: string;
  participantId: string;
}

export interface HistoryPayload {
  type: WsEvent.History;
  sessionId: string;
  messages: Message[];
}

export type WsPayload =
  | JoinPayload
  | LeavePayload
  | MessagePayload
  | TypingPayload
  | AiChunkPayload
  | AiDonePayload
  | AiErrorPayload
  | ErrorPayload
  | PresencePayload
  | MessageAckPayload
  | ReconnectPayload
  | HistoryPayload;
