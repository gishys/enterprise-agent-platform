import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { RagModule } from "../rag/rag.module.js";
import { RecommendationModule } from "../recommendation/recommendation.module.js";
import { ConversationController } from "./conversation.controller.js";
import { ConversationService } from "./conversation.service.js";

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, RagModule, LlmModule, RecommendationModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService]
})
export class ConversationModule {}
