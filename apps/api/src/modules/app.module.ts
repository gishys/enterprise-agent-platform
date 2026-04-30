import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module.js";
import { ConversationModule } from "./conversation/conversation.module.js";
import { GovernanceModule } from "./governance/governance.module.js";
import { KnowledgeModule } from "./knowledge/knowledge.module.js";
import { OperationsModule } from "./operations/operations.module.js";
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
    OperationsModule
  ]
})
export class AppModule {}
