import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "@ai-service/shared";
import type { AuthenticatedRequest, JwtPayload } from "./auth.types.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("未登录或登录已过期");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret"
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== "ACTIVE") {
        throw new UnauthorizedException("用户不存在或已停用");
      }
      request.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        department: user.department,
        role: user.role as AuthUser["role"]
      };
      return true;
    } catch {
      throw new UnauthorizedException("未登录或登录已过期");
    }
  }

  private extractToken(request: AuthenticatedRequest) {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
