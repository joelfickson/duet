export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamParams {
  messages: LlmMessage[];
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  timeout?: number;
}

export type LlmErrorCode =
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "OVERLOADED"
  | "TIMEOUT"
  | "UNKNOWN";

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}

export interface LlmProvider {
  stream(params: StreamParams): AsyncGenerator<string>;
}

export type ProviderId = "anthropic" | "gemini" | "openrouter";
