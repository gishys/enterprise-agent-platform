import { Injectable } from "@nestjs/common";
import { highRiskTriggers, responseGuardrails, sensitivityRules } from "@ai-service/shared";

@Injectable()
export class GovernanceService {
  guardrails() {
    return {
      responseGuardrails,
      sensitivityRules,
      highRiskTriggers
    };
  }

  screen(content: string) {
    const triggers = highRiskTriggers.filter((trigger) => content?.includes(trigger));
    return {
      allowed: triggers.length === 0,
      requiresHumanHandoff: triggers.length > 0,
      triggers,
      decision: triggers.length > 0 ? "handoff" : "continue"
    };
  }
}
