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

export interface Message {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  content: string;
  role: MessageRole;
  createdAt: string;
}

export enum WsEvent {
  Join = "join",
  Leave = "leave",
  Message = "message",
  MessageAck = "message-ack",
  Typing = "typing",
  AiChunk = "ai-chunk",
  Error = "error",
  Presence = "presence",
  Reconnect = "reconnect",
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

export type WsPayload =
  | JoinPayload
  | LeavePayload
  | MessagePayload
  | TypingPayload
  | AiChunkPayload
  | ErrorPayload
  | PresencePayload
  | MessageAckPayload
  | ReconnectPayload;
