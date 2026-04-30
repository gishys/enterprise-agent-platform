import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "../config/app.config.js";
import { AgentModule } from "./agent/agent.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ConversationModule } from "./conversation/conversation.module.js";
import { EvaluationsModule } from "./evaluations/evaluations.module.js";
import { GovernanceModule } from "./governance/governance.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { LlmModule } from "./llm/llm.module.js";
import { OperationsModule } from "./operations/operations.module.js";
import { PromptsModule } from "./prompts/prompts.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RagModule } from "./rag/rag.module.js";
import { RecommendationModule } from "./recommendation/recommendation.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),
    PrismaModule,
    AuthModule,
    ConversationModule,
    LlmModule,
    KnowledgeModule,
    RagModule,
    GovernanceModule,
    OperationsModule,
    AgentModule,
    PromptsModule,
    EvaluationsModule,
    AuditModule,
    RecommendationModule
  ]
})
export class AppModule {}
