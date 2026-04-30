import { Injectable } from "@nestjs/common";
import { promptTemplates, templateCatalog, type OperationsDashboard } from "@ai-service/shared";

@Injectable()
export class OperationsService {
  dashboard(): OperationsDashboard {
    return {
      knowledgeHitRate: 0.86,
      noAnswerRate: 0.07,
      humanHandoffRate: 0.14,
      satisfaction: 4.6,
      averageResponseMs: 920,
      unresolvedQuestions: 12,
      evaluationPassRate: 0.91
    };
  }

  templates() {
    return {
      templateCatalog,
      promptTemplates,
      promptLifecycle: ["draft", "reviewing", "published", "archived"],
      releasePolicy: "Prompt 发布需管理员审核，并记录版本、审计事件和评测结果。"
    };
  }
}
