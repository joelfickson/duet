export type {
  LlmMessage as MessageParam,
  StreamParams as StreamCompletionParams,
} from "./providers";
export { LlmError } from "./providers";

import type { StreamParams } from "./providers";
import { getProvider } from "./providers";

export async function* streamCompletion(
  params: StreamParams,
): AsyncGenerator<string> {
  yield* getProvider("anthropic").stream(params);
}
