import { Controller, Get } from "@nestjs/common";
import { OperationsService } from "./operations.service.js";

@Controller("operations")
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get("dashboard")
  dashboard() {
    return this.operationsService.dashboard();
  }

  @Get("templates")
  templates() {
    return this.operationsService.templates();
  }
}
