import { Body, Controller, Post } from "@nestjs/common";
import { RagService } from "./rag.service.js";

@Controller("rag")
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post("retrieve")
  retrieve(@Body("query") query: string) {
    return this.ragService.retrieve(query);
  }
}
