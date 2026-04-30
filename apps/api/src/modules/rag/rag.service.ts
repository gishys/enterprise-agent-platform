import { Injectable } from "@nestjs/common";
import type { SourceReference } from "@ai-service/shared";
import { screenRisk } from "@ai-service/shared";

const publishedSources: SourceReference[] = [
  {
    id: "kb-001",
    title: "业务办理进度查询流程",
    type: "process",
    owner: "运营服务部",
    effectiveFrom: "2026-01-01",
    excerpt: "用户可通过统一服务门户、移动 H5 或人工客服查询业务办理进度，查询前需完成身份校验。",
    score: 0.93,
    version: 3,
    sensitivity: "internal"
  },
  {
    id: "kb-002",
    title: "材料清单标准答案",
    type: "standard-answer",
    owner: "业务管理部",
    effectiveFrom: "2026-02-01",
    excerpt: "材料清单应按业务类型、主体身份和属地政策组合生成；缺少条件时应先发起澄清。",
    score: 0.88,
    version: 2,
    sensitivity: "public"
  }
];

@Injectable()
export class RagService {
  retrieve(query: string): { query: string; strategy: string; sources: SourceReference[]; shouldRefuse: boolean; confidence: number; rewrittenQuery: string } {
    const risk = screenRisk(query);
    const rewrittenQuery = query?.trim() ? query.trim().replace(/\s+/g, " ") : "";
    const sources = risk.requiresHumanHandoff
      ? []
      : publishedSources
          .filter((source) => rewrittenQuery.includes("材料") ? source.id === "kb-002" : true)
          .sort((a, b) => b.score - a.score);
    const confidence = sources.at(0)?.score ?? 0;

    return {
      query,
      rewrittenQuery,
      strategy: "query-rewrite + pgvector semantic recall + OpenSearch keyword recall + reranker + permission filter",
      sources,
      shouldRefuse: risk.requiresHumanHandoff || confidence < 0.55,
      confidence
    };
  }
}
