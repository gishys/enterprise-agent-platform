import type { AuthUser, UserRole } from "@ai-service/shared";
import type { Request } from "express";

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  cookies: Record<string, string>;
  headers: Request["headers"] & {
    authorization?: string;
    "user-agent"?: string;
  };
}
