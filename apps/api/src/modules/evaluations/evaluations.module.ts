import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { EvaluationsController } from "./evaluations.controller.js";
import { EvaluationsService } from "./evaluations.service.js";

@Module({
  imports: [AuthModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService]
})
export class EvaluationsModule {}
