import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { RagController } from "./rag.controller.js";
import { RagIndexService } from "./rag-index.service.js";
import { RagService } from "./rag.service.js";

@Module({
  imports: [PrismaModule, LlmModule],
  controllers: [RagController],
  providers: [RagService, RagIndexService],
  exports: [RagService, RagIndexService]
})
export class RagModule {}
