import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmbeddingService {
  constructor(private readonly config: ConfigService) {}

  get dimensions() {
    return Number(this.config.get("EMBEDDING_DIMENSIONS") ?? 1536);
  }

  isConfigured() {
    return Boolean(this.config.get("EMBEDDING_API_KEY") && this.config.get("EMBEDDING_BASE_URL") && this.config.get("EMBEDDING_MODEL"));
  }

  async embed(input: string): Promise<number[]> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Embedding provider is not configured. Set EMBEDDING_API_KEY, EMBEDDING_BASE_URL, and EMBEDDING_MODEL.");
    }

    const baseUrl = String(this.config.get("EMBEDDING_BASE_URL")).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.get("EMBEDDING_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.get("EMBEDDING_MODEL"),
        input
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ServiceUnavailableException(`Embedding request failed with ${response.status}: ${detail.slice(0, 240)}`);
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding?.length) {
      throw new ServiceUnavailableException("Embedding provider returned an empty vector.");
    }
    return embedding;
  }
}
