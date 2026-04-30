import { Controller, Get } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service.js";

@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  list() {
    return this.knowledgeService.list();
  }
}
