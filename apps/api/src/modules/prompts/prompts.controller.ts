import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { PromptsService } from "./prompts.service.js";

@Controller("prompts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Post(":id/publish")
  publish(@Param("id") id: string, @Body("reviewer") reviewer?: string) {
    return this.promptsService.publish(id, reviewer);
  }
}
