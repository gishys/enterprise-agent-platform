import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Knowledge, SensitivityLevel } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { EmbeddingService } from "../llm/embedding.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

interface ChunkInput {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

@Injectable()
export class RagIndexService {
  constructor(
    private readonly config: ConfigService,
    private readonly embedding: EmbeddingService,
    private readonly prisma: PrismaService
  ) {}

  async indexKnowledge(knowledge: Knowledge) {
    if (!this.embedding.isConfigured()) {
      throw new ServiceUnavailableException("Cannot publish RAG index until an embedding provider is configured.");
    }

    await this.prisma.knowledge.update({
      where: { id: knowledge.id },
      data: { parseStatus: "embedding" }
    });

    const chunks = await this.buildChunks(knowledge);
    await this.prisma.$executeRaw`DELETE FROM "KnowledgeChunk" WHERE "knowledgeId" = ${knowledge.id}`;
    await this.deleteOpenSearchKnowledge(knowledge.id).catch(() => undefined);

    for (const chunk of chunks) {
      await this.insertVectorChunk(knowledge, chunk);
      await this.indexOpenSearchChunk(knowledge, chunk);
    }

    await this.prisma.knowledge.update({
      where: { id: knowledge.id },
      data: { parseStatus: "indexed", chunkCount: chunks.length }
    });

    return { chunkCount: chunks.length, status: "indexed" };
  }

  private async buildChunks(knowledge: Knowledge): Promise<ChunkInput[]> {
    const text = knowledge.body.replace(/\s+/g, " ").trim();
    const windows = this.chunkText(text);
    const chunks: ChunkInput[] = [];
    for (let index = 0; index < windows.length; index += 1) {
      const content = windows[index];
      chunks.push({
        id: `${knowledge.id}-chunk-${index + 1}`,
        content,
        embedding: await this.embedding.embed(`${knowledge.title}\n${content}`),
        metadata: { sourceFile: knowledge.sourceFile, chunkIndex: index, title: knowledge.title }
      });
    }
    return chunks;
  }

  private chunkText(text: string) {
    const size = 900;
    const overlap = 120;
    if (text.length <= size) return [text];
    const chunks: string[] = [];
    for (let cursor = 0; cursor < text.length; cursor += size - overlap) {
      chunks.push(text.slice(cursor, cursor + size));
    }
    return chunks;
  }

  private async insertVectorChunk(knowledge: Knowledge, chunk: ChunkInput) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "KnowledgeChunk" (
          "id", "knowledgeId", "content", "embedding", "metadata", "title", "type", "owner",
          "sourceUrl", "version", "sensitivity", "effectiveFrom", "effectiveTo", "tokenCount", "updatedAt"
        )
        VALUES (
          ${chunk.id}, ${knowledge.id}, ${chunk.content}, ${chunk.embedding as Prisma.InputJsonArray}, ${chunk.metadata as Prisma.InputJsonObject},
          ${knowledge.title}, ${knowledge.type}, ${knowledge.owner}, ${knowledge.sourceUrl}, ${knowledge.version},
          ${knowledge.sensitivity as SensitivityLevel}, ${knowledge.effectiveFrom}, ${knowledge.effectiveTo},
          ${Math.ceil(chunk.content.length / 2)}, NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "content" = EXCLUDED."content",
          "embedding" = EXCLUDED."embedding",
          "metadata" = EXCLUDED."metadata",
          "updatedAt" = NOW()
      `
    );
  }

  private async indexOpenSearchChunk(knowledge: Knowledge, chunk: ChunkInput) {
    const url = this.openSearchUrl();
    if (!url) return;
    await fetch(`${url}/knowledge_chunks/_doc/${encodeURIComponent(chunk.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        knowledgeId: knowledge.id,
        chunkId: chunk.id,
        title: knowledge.title,
        content: chunk.content,
        type: knowledge.type,
        owner: knowledge.owner,
        version: knowledge.version,
        sensitivity: knowledge.sensitivity,
        status: knowledge.status,
        effectiveFrom: knowledge.effectiveFrom?.toISOString(),
        effectiveTo: knowledge.effectiveTo?.toISOString(),
        sourceUrl: knowledge.sourceUrl,
        metadata: chunk.metadata
      })
    });
  }

  private async deleteOpenSearchKnowledge(knowledgeId: string) {
    const url = this.openSearchUrl();
    if (!url) return;
    await fetch(`${url}/knowledge_chunks/_delete_by_query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { term: { knowledgeId } } })
    });
  }

  private openSearchUrl() {
    return this.config.get<string>("OPENSEARCH_URL")?.replace(/\/$/, "");
  }
}
