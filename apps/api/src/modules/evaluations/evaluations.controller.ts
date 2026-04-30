import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { EvaluationsService } from "./evaluations.service.js";

@Controller("evaluations")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "AUDITOR")
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get("runs")
  runs() {
    return this.evaluationsService.runs();
  }
}
