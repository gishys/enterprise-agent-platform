import { Injectable } from "@nestjs/common";
import { highRiskTriggers, responseGuardrails, screenRisk, sensitivityRules } from "@ai-service/shared";

@Injectable()
export class GovernanceService {
  guardrails() {
    return {
      responseGuardrails,
      sensitivityRules,
      highRiskTriggers,
      fallbackPolicy: {
        lowConfidence: "ask_clarifying_question",
        highRisk: "refuse_and_handoff",
        restrictedData: "handoff_with_audit"
      }
    };
  }

  screen(content: string) {
    return screenRisk(content);
  }
}
