import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openrouterProvider } from "./openrouter";
import type { LlmProvider, ProviderId } from "./types";

export type { LlmMessage, ProviderId, StreamParams } from "./types";
export { LlmError } from "./types";

const providers: Record<ProviderId, LlmProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
};

export function getProvider(id: ProviderId): LlmProvider {
  return providers[id];
}
