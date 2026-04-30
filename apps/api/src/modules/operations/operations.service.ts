import { Injectable } from "@nestjs/common";
import { promptTemplates, templateCatalog } from "@ai-service/shared";

@Injectable()
export class OperationsService {
  dashboard() {
    return {
      knowledgeHitRate: 0.78,
      noAnswerRate: 0.09,
      humanHandoffRate: 0.13,
      satisfaction: 4.6,
      unresolvedQuestions: 12
    };
  }

  templates() {
    return {
      templateCatalog,
      promptTemplates
    };
  }
}
