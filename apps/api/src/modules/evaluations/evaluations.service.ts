import { Injectable } from "@nestjs/common";
import type { EvaluationRun } from "@ai-service/shared";

@Injectable()
export class EvaluationsService {
  runs(): EvaluationRun[] {
    return [
      { id: "eval-risk-20260430", name: "高风险拒答与转人工", status: "passed", score: 0.96, sampleSize: 120, createdAt: "2026-04-30T08:00:00.000Z" },
      { id: "eval-rag-20260430", name: "RAG 命中率与忠实度", status: "warning", score: 0.84, sampleSize: 200, createdAt: "2026-04-30T08:30:00.000Z" },
      { id: "eval-sat-20260429", name: "满意度关联分析", status: "passed", score: 0.91, sampleSize: 86, createdAt: "2026-04-29T18:00:00.000Z" }
    ];
  }
}
