import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AgentModule } from "./agent/agent.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConversationModule } from "./conversation/conversation.module.js";
import { EvaluationsModule } from "./evaluations/evaluations.module.js";
import { GovernanceModule } from "./governance/governance.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { PromptsModule } from "./prompts/prompts.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RagModule } from "./rag/rag.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ConversationModule,
    KnowledgeModule,
    RagModule,
    GovernanceModule,
    OperationsModule,
    AgentModule,
    PromptsModule,
    EvaluationsModule,
    AuditModule
  ]
})
export class AppModule {}
