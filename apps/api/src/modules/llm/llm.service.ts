import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChatMessageInput, DeepSeekChunk, DeepSeekStreamResult } from "./llm.types.js";

@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService) {}

  async *streamChat(messages: ChatMessageInput[]): AsyncGenerator<DeepSeekChunk, DeepSeekStreamResult> {
    const apiKey = this.config.get<string>("DEEPSEEK_API_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException("DeepSeek API key is not configured.");
    }

    const controller = new AbortController();
    const timeoutMs = Number(this.config.get("DEEPSEEK_TIMEOUT_MS") ?? 30000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const baseUrl = (this.config.get<string>("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, "");

    let content = "";
    let traceId: string | undefined;
    let model: string | undefined;
    let finishReason: string | undefined;
    let tokenUsage: number | undefined;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash",
          messages,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: Number(this.config.get("DEEPSEEK_MAX_TOKENS") ?? 1200),
          thinking: { type: "disabled" }
        })
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new ServiceUnavailableException(`DeepSeek request failed with ${response.status}: ${detail.slice(0, 240)}`);
      }

      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            return { content, traceId, model, finishReason, tokenUsage };
          }

          const parsed = JSON.parse(data) as {
            id?: string;
            model?: string;
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          };
          traceId = parsed.id ?? traceId;
          model = parsed.model ?? model;
          finishReason = parsed.choices?.[0]?.finish_reason ?? finishReason;
          tokenUsage = parsed.usage?.total_tokens ?? tokenUsage;
          const delta = parsed.choices?.[0]?.delta?.content ?? "";
          if (delta) content += delta;
          yield { delta, id: parsed.id, model: parsed.model, finishReason, usage: parsed.usage };
        }
      }

      return { content, traceId, model, finishReason, tokenUsage };
    } finally {
      clearTimeout(timeout);
    }
  }
}
