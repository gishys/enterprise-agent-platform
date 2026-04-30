import { Body, Controller, Get, Header, Param, Post, Sse, UseGuards, type MessageEvent, Res } from "@nestjs/common";
import type { AuthUser, Channel, RecommendationEventType } from "@ai-service/shared";
import type { Response } from "express";
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
  sendMessage(
    @Param("id") id: string,
    @Body("content") content: string,
    @CurrentUser() user: AuthUser,
    @Body("recommendationId") recommendationId?: string
  ) {
    return this.conversationService.sendMessage(id, content, user, recommendationId);
  }

  @Post(":id/messages/stream")
  @Header("Content-Type", "text/event-stream")
  @Header("Cache-Control", "no-cache, no-transform")
  @Header("Connection", "keep-alive")
  async streamMessage(
    @Param("id") id: string,
    @Body("content") content: string,
    @Body("recommendationId") recommendationId: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() response: Response
  ) {
    response.flushHeaders?.();
    await this.conversationService.streamMessage(id, content, user, (event) => {
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }, recommendationId);
    response.end();
  }

  @Get(":id/recommendations")
  recommendations(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.conversationService.listRecommendations(id, user);
  }

  @Post(":id/recommendations/refresh")
  refreshRecommendations(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.conversationService.refreshRecommendations(id, user);
  }

  @Post(":id/recommendations/:recommendationId/events")
  recordRecommendationEvent(
    @Param("id") id: string,
    @Param("recommendationId") recommendationId: string,
    @Body("eventType") eventType: RecommendationEventType,
    @Body("metadata") metadata: Record<string, unknown> | undefined,
    @CurrentUser() user: AuthUser
  ) {
    return this.conversationService.recordRecommendationEvent(id, recommendationId, eventType, user, metadata);
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
