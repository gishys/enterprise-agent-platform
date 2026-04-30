import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AuditService } from "./audit.service.js";

@Controller("audit-events")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "AUDITOR")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  events() {
    return this.auditService.events();
  }
}
