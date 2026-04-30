import { Body, Controller, Get, Param, Post, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import type { AuthUser, Channel } from "@ai-service/shared";
import type { Observable } from "rxjs";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ConversationService } from "./conversation.service.js";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body("channel") channel?: Channel) {
    return this.conversationService.createConversation(user, channel ?? "mobile-h5");
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.conversationService.getConversation(id, user);
  }

  @Post(":id/messages")
  sendMessage(@Param("id") id: string, @Body("content") content: string, @CurrentUser() user: AuthUser) {
    return this.conversationService.sendMessage(id, content, user);
  }

  @Post(":id/handoff")
  requestHuman(@Param("id") id: string, @CurrentUser() user: AuthUser, @Body("reason") reason?: string) {
    return this.conversationService.requestHumanHandoff(id, user, reason ?? "用户主动请求人工客服");
  }

  @Post(":id/satisfaction")
  rate(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body("score") score: "satisfied" | "neutral" | "unsatisfied",
    @Body("messageId") messageId?: string
  ) {
    return this.conversationService.recordSatisfaction(id, user, score, messageId);
  }

  @Sse(":id/stream")
  stream(@Param("id") id: string, @CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.conversationService.streamAssistantAnswer(id, user);
  }
}
