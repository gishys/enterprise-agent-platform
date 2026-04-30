import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service.js";
import { LlmService } from "./llm.service.js";

@Module({
  providers: [EmbeddingService, LlmService],
  exports: [EmbeddingService, LlmService]
})
export class LlmModule {}
