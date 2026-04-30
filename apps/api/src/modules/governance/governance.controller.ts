import { Body, Controller, Get, Post } from "@nestjs/common";
import { GovernanceService } from "./governance.service.js";

@Controller("governance")
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get("guardrails")
  guardrails() {
    return this.governanceService.guardrails();
  }

  @Post("screen")
  screen(@Body("content") content: string) {
    return this.governanceService.screen(content);
  }
}
