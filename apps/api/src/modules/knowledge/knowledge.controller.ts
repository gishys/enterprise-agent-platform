import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { KnowledgeService } from "./knowledge.service.js";

@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  list() {
    return this.knowledgeService.list();
  }

  @Post("uploads")
  upload(@Body("fileName") fileName?: string) {
    return this.knowledgeService.createUploadJob(fileName);
  }

  @Get("jobs/:id")
  job(@Param("id") id: string) {
    return this.knowledgeService.getJob(id);
  }

  @Post(":id/publish")
  publish(@Param("id") id: string, @Body("reviewer") reviewer?: string) {
    return this.knowledgeService.publish(id, reviewer);
  }
}
