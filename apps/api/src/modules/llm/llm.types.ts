export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChunk {
  delta: string;
  id?: string;
  model?: string;
  finishReason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface DeepSeekStreamResult {
  content: string;
  traceId?: string;
  model?: string;
  finishReason?: string;
  tokenUsage?: number;
}
