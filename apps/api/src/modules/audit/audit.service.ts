import { Injectable } from "@nestjs/common";
import type { AuditEvent } from "@ai-service/shared";

@Injectable()
export class AuditService {
  events(): AuditEvent[] {
    return [
      {
        id: "audit-001",
        actorId: "admin",
        action: "knowledge.publish",
        resourceType: "Knowledge",
        resourceId: "kb-001",
        riskLevel: "low",
        createdAt: "2026-04-30T09:15:00.000Z",
        metadata: { version: 3, reviewer: "admin" }
      },
      {
        id: "audit-002",
        actorId: "agent",
        action: "conversation.handoff",
        resourceType: "Conversation",
        resourceId: "demo-risk-001",
        riskLevel: "high",
        createdAt: "2026-04-30T09:28:00.000Z",
        metadata: { triggers: ["删除审计", "伪造材料"] }
      }
    ];
  }
}
