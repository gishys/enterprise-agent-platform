import { Injectable } from "@nestjs/common";
import type { SourceReference } from "@ai-service/shared";

@Injectable()
export class RagService {
  retrieve(query: string): { query: string; strategy: string; sources: SourceReference[]; shouldRefuse: boolean } {
    const risky = ["涉密", "处罚结论", "执法", "个人隐私"].some((word) => query?.includes(word));
    return {
      query,
      strategy: "keyword + pgvector + opensearch + reranker",
      shouldRefuse: risky,
      sources: risky
        ? []
        : [
            {
              id: "kb-001",
              title: "政企服务事项办理指引",
              type: "process",
              owner: "业务运营部",
              effectiveFrom: "2026-01-01",
              excerpt: "对办理类咨询优先提供条件、材料、路径和人工兜底方式。",
              score: 0.91
            }
          ]
    };
  }
}
