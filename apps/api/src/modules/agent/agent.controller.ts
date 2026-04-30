import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { AuthUser } from "@ai-service/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AgentService } from "./agent.service.js";

@Controller("agent")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("AGENT", "ADMIN")
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get("conversations")
  conversations() {
    return this.agentService.conversations();
  }

  @Post("conversations/:id/replies")
  reply(@Param("id") id: string, @Body("content") content: string, @CurrentUser() user: AuthUser) {
    return this.agentService.reply(id, content, user);
  }
}
