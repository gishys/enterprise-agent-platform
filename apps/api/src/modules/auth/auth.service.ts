import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { LoginRequest, LoginResponse, AuthUser } from "@ai-service/shared";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service.js";
import type { JwtPayload } from "./auth.types.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(body: LoginRequest, userAgent: string | undefined, response: Response): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({ where: { username: body.username } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("账号或密码错误");
    }
    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      throw new UnauthorizedException("账号或密码错误");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const authUser = this.toAuthUser(user);
    const accessToken = await this.signAccessToken(authUser);
    await this.issueRefreshToken(authUser.id, userAgent, response);
    await this.audit(authUser.id, "auth.login", "User", authUser.id, "low", { username: authUser.username });
    return { accessToken, user: authUser };
  }

  async refresh(refreshToken: string | undefined, userAgent: string | undefined, response: Response): Promise<LoginResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException("刷新令牌不存在");
    }
    const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
      secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret"
    }).catch(() => undefined);
    if (!payload) {
      throw new UnauthorizedException("刷新令牌无效");
    }
    const tokenRows = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    const matched = await this.findMatchingRefreshToken(tokenRows, refreshToken);
    if (!matched) {
      throw new UnauthorizedException("刷新令牌已失效");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("用户不存在或已停用");
    }
    await this.prisma.refreshToken.update({ where: { id: matched.id }, data: { revokedAt: new Date() } });
    const authUser = this.toAuthUser(user);
    await this.issueRefreshToken(authUser.id, userAgent, response);
    return { accessToken: await this.signAccessToken(authUser), user: authUser };
  }

  async logout(refreshToken: string | undefined, response: Response) {
    if (refreshToken) {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret"
      }).catch(() => undefined);
      if (payload) {
        const rows = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null } });
        const matched = await this.findMatchingRefreshToken(rows, refreshToken);
        if (matched) {
          await this.prisma.refreshToken.update({ where: { id: matched.id }, data: { revokedAt: new Date() } });
        }
      }
    }
    response.clearCookie("refreshToken", { path: "/api/auth" });
    return { success: true };
  }

  private async signAccessToken(user: AuthUser) {
    return this.jwtService.signAsync(
      { sub: user.id, username: user.username, role: user.role },
      {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret",
        expiresIn: this.configService.get<string>("ACCESS_TOKEN_TTL") ?? "15m"
      }
    );
  }

  private async issueRefreshToken(userId: string, userAgent: string | undefined, response: Response) {
    const days = Number(this.configService.get<string>("REFRESH_TOKEN_DAYS") ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret",
        expiresIn: `${days}d`
      }
    );
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: await argon2.hash(refreshToken),
        userAgent,
        expiresAt
      }
    });
    response.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.configService.get<string>("COOKIE_SECURE") === "true",
      path: "/api/auth",
      expires: expiresAt
    });
  }

  private async findMatchingRefreshToken(rows: { id: string; tokenHash: string }[], token: string) {
    for (const row of rows) {
      if (await argon2.verify(row.tokenHash, token)) {
        return row;
      }
    }
    return undefined;
  }

  private toAuthUser(user: { id: string; username: string; displayName: string; department: string | null; role: string }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      department: user.department,
      role: user.role as AuthUser["role"]
    };
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string, riskLevel: string, metadata: Record<string, unknown>) {
    await this.prisma.auditEvent.create({
      data: { actorId, action, resourceType, resourceId, riskLevel, metadata: metadata as Prisma.InputJsonObject }
    });
  }
}
