import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { LoginRequest } from "@ai-service/shared";
import type { Response } from "express";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import type { AuthUser } from "@ai-service/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginRequest, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(body, request.headers["user-agent"], response);
  }

  @Post("refresh")
  async refresh(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(request.cookies?.refreshToken, request.headers["user-agent"], response);
  }

  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request.cookies?.refreshToken, response);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
