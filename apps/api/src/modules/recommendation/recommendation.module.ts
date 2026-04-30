import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { RecommendationService } from "./recommendation.service.js";

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [RecommendationService],
  exports: [RecommendationService]
})
export class RecommendationModule {}
