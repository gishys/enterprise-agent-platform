import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser, RagRetrievalResult, SensitivityLevel, SourceReference } from "@ai-service/shared";
import { screenRisk } from "@ai-service/shared";
import { EmbeddingService } from "../llm/embedding.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

interface RawChunkHit {
  chunkId: string;
  knowledgeId: string;
  title: string;
  type: SourceReference["type"];
  owner: string;
  sourceUrl: string | null;
  version: number;
  sensitivity: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  content: string;
  score: number;
  stage: "pgvector" | "opensearch" | "keyword";
}

@Injectable()
export class RagService {
  constructor(
    private readonly config: ConfigService,
    private readonly embedding: EmbeddingService,
    private readonly prisma: PrismaService
  ) {}

  async retrieve(query: string, user?: AuthUser): Promise<RagRetrievalResult> {
    const risk = screenRisk(query ?? "");
    const rewrittenQuery = this.rewriteQuery(query);
    if (!rewrittenQuery || risk.requiresHumanHandoff) {
      return {
        query,
        rewrittenQuery,
        strategy: "risk-screen + no-retrieval",
        sources: [],
        shouldRefuse: true,
        confidence: 0
      };
    }

    const [semanticHits, keywordHits, fallbackHits] = await Promise.all([
      this.semanticRecall(rewrittenQuery, user).catch(() => []),
      this.openSearchRecall(rewrittenQuery, user).catch(() => []),
      this.databaseKeywordRecall(rewrittenQuery, user).catch(() => [])
    ]);
    const sources = this.fuseAndRerank([...semanticHits, ...keywordHits, ...fallbackHits]);
    const confidence = sources.at(0)?.score ?? 0;

    return {
      query,
      rewrittenQuery,
      strategy: "query-rewrite + pgvector semantic recall + OpenSearch BM25 recall + score fusion + permission/effective-date filter",
      sources,
      shouldRefuse: confidence < 0.55,
      confidence
    };
  }

  private rewriteQuery(query: string) {
    return query?.trim().replace(/\s+/g, " ") ?? "";
  }

  private async semanticRecall(query: string, user?: AuthUser): Promise<RawChunkHit[]> {
    if (!this.embedding.isConfigured()) return [];
    const vector = await this.embedding.embed(query);
    const topK = Number(this.config.get("RAG_TOP_K") ?? 8);
    const sensitivities = this.allowedSensitivities(user);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        sensitivity: { in: sensitivities as Uppercase<SensitivityLevel>[] },
        knowledge: { status: "PUBLISHED" },
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
        AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] }]
      },
      take: Math.max(topK * 20, topK)
    });

    return chunks
      .map((chunk) => ({
        chunkId: chunk.id,
        knowledgeId: chunk.knowledgeId,
        title: chunk.title,
        type: chunk.type as SourceReference["type"],
        owner: chunk.owner,
        sourceUrl: chunk.sourceUrl,
        version: chunk.version,
        sensitivity: chunk.sensitivity,
        effectiveFrom: chunk.effectiveFrom,
        effectiveTo: chunk.effectiveTo,
        content: chunk.content,
        score: this.cosineSimilarity(vector, this.toVector(chunk.embedding)),
        stage: "pgvector" as const
      }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  private async openSearchRecall(query: string, user?: AuthUser): Promise<RawChunkHit[]> {
    const url = this.config.get<string>("OPENSEARCH_URL")?.replace(/\/$/, "");
    if (!url) return [];
    const topK = Number(this.config.get("RAG_TOP_K") ?? 8);
    const response = await fetch(`${url}/knowledge_chunks/_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: topK,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ["title^3", "content^2", "type", "owner"],
                  type: "best_fields"
                }
              }
            ],
            filter: [
              { terms: { sensitivity: this.allowedSensitivities(user) } },
              { term: { status: "PUBLISHED" } }
            ]
          }
        }
      })
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      hits?: { hits?: Array<{ _score?: number; _source?: Record<string, unknown> }> };
    };
    return (
      payload.hits?.hits?.map((hit) => {
        const source = hit._source ?? {};
        return {
          chunkId: String(source.chunkId),
          knowledgeId: String(source.knowledgeId),
          title: String(source.title),
          type: String(source.type) as SourceReference["type"],
          owner: String(source.owner),
          sourceUrl: source.sourceUrl ? String(source.sourceUrl) : null,
          version: Number(source.version ?? 1),
          sensitivity: String(source.sensitivity),
          effectiveFrom: source.effectiveFrom ? new Date(String(source.effectiveFrom)) : null,
          effectiveTo: source.effectiveTo ? new Date(String(source.effectiveTo)) : null,
          content: String(source.content),
          score: Math.min(0.98, (hit._score ?? 0) / 10),
          stage: "opensearch"
        };
      }) ?? []
    );
  }

  private async databaseKeywordRecall(query: string, user?: AuthUser): Promise<RawChunkHit[]> {
    const words = query.split(/\s+/).filter(Boolean);
    const knowledge = await this.prisma.knowledge.findMany({
      where: {
        status: "PUBLISHED",
        sensitivity: { in: this.allowedSensitivities(user) as Uppercase<SensitivityLevel>[] },
        OR: words.flatMap((word) => [{ title: { contains: word } }, { body: { contains: word } }])
      },
      take: Number(this.config.get("RAG_TOP_K") ?? 8)
    });
    return knowledge.map((item) => ({
      chunkId: `${item.id}-body`,
      knowledgeId: item.id,
      title: item.title,
      type: item.type as SourceReference["type"],
      owner: item.owner,
      sourceUrl: item.sourceUrl,
      version: item.version,
      sensitivity: item.sensitivity,
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo,
      content: item.body,
      score: this.lexicalScore(query, `${item.title} ${item.body}`),
      stage: "keyword"
    }));
  }

  private fuseAndRerank(hits: RawChunkHit[]): SourceReference[] {
    const byChunk = new Map<string, RawChunkHit>();
    for (const hit of hits) {
      const existing = byChunk.get(hit.chunkId);
      if (!existing || hit.score > existing.score) byChunk.set(hit.chunkId, hit);
    }
    const rerankTopK = Number(this.config.get("RERANK_TOP_K") ?? 5);
    return [...byChunk.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, rerankTopK)
      .map((hit) => ({
        id: hit.knowledgeId,
        chunkId: hit.chunkId,
        title: hit.title,
        type: hit.type,
        owner: hit.owner,
        effectiveFrom: hit.effectiveFrom?.toISOString() ?? new Date().toISOString(),
        effectiveTo: hit.effectiveTo?.toISOString(),
        url: hit.sourceUrl ?? undefined,
        excerpt: hit.content.slice(0, 260),
        score: Number(Math.max(0, Math.min(0.99, hit.score)).toFixed(2)),
        version: hit.version,
        sensitivity: hit.sensitivity.toLowerCase() as SensitivityLevel,
        indexStage: hit.stage === "keyword" ? "hybrid" : hit.stage
      }));
  }

  private lexicalScore(query: string, text: string) {
    const normalized = text.toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return 0;
    const matches = terms.filter((term) => normalized.includes(term)).length;
    return 0.55 + Math.min(0.35, matches / terms.length / 3);
  }

  private toVector(value: unknown) {
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  }

  private cosineSimilarity(a: number[], b: number[]) {
    const length = Math.min(a.length, b.length);
    if (!length) return 0;
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    for (let index = 0; index < length; index += 1) {
      dot += a[index] * b[index];
      aNorm += a[index] * a[index];
      bNorm += b[index] * b[index];
    }
    if (!aNorm || !bNorm) return 0;
    return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
  }

  private allowedSensitivities(user?: AuthUser) {
    if (user?.role === "ADMIN" || user?.role === "AUDITOR") return ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"];
    if (user?.role === "AGENT") return ["PUBLIC", "INTERNAL", "SENSITIVE"];
    return ["PUBLIC", "INTERNAL"];
  }
}
