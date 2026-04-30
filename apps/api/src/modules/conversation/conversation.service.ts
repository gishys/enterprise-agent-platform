import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Channel, ConversationStatus, MessageRole, Prisma } from "@prisma/client";
import {
  defaultEntryConfiguration,
  screenRisk,
  type AuthUser,
  type ChatMessage,
  type ChatStreamEvent,
  type ConversationSummary,
  type RecommendationEventType,
  type RagRetrievalResult,
  type SourceReference
} from "@ai-service/shared";
import { Observable } from "rxjs";
import { LlmService } from "../llm/llm.service.js";
import type { ChatMessageInput, DeepSeekStreamResult } from "../llm/llm.types.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RagService } from "../rag/rag.service.js";
import { RecommendationService } from "../recommendation/recommendation.service.js";

type EmitStreamEvent = (event: ChatStreamEvent) => void;

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
    private readonly llm: LlmService,
    private readonly recommendations: RecommendationService
  ) {}

  async createConversation(user: AuthUser, channel: "web-chat" | "mobile-h5"): Promise<ConversationSummary> {
    const conversation = await this.prisma.conversation.create({
      data: {
        channel: channel === "web-chat" ? Channel.WEB_CHAT : Channel.MOBILE_H5,
        userId: user.id,
        status: ConversationStatus.WAITING_FOR_USER,
        messages: {
          create: {
            role: MessageRole.ASSISTANT,
            content: defaultEntryConfiguration.welcomeMessage,
            auditTags: ["welcome", "entry-config", "prompt:base-service-role@v1"],
            promptVersion: "base-service-role@v1"
          }
        }
      },
      include: this.includeConversation()
    });
    await this.audit(user.id, "conversation.create", "Conversation", conversation.id, "low", { channel, department: user.department });
    return this.toSummary(conversation, user);
  }

  async getConversation(conversationId: string, user: AuthUser): Promise<ConversationSummary> {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    return this.toSummary(conversation, user);
  }

  async sendMessage(conversationId: string, content: string, user: AuthUser, recommendationId?: string) {
    let completed: ConversationSummary | undefined;
    await this.streamMessage(conversationId, content, user, (event) => {
      if (event.type === "answer.completed") completed = event.conversation;
    }, recommendationId);
    return completed ?? this.getConversation(conversationId, user);
  }

  async streamMessage(conversationId: string, content: string, user: AuthUser, emit: EmitStreamEvent, recommendationId?: string) {
    const startedAt = Date.now();
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    const trimmed = content?.trim();
    if (!trimmed) throw new BadRequestException("Message content is required.");

    const risk = screenRisk(trimmed);
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: trimmed,
        auditTags: risk.triggers.length ? ["risk-input"] : []
      }
    });
    emit({ type: "message.created", conversationId, message: this.toChatMessage(userMessage, []) });
    if (recommendationId) {
      await this.recommendations.recordEvent(conversationId, recommendationId, "sent", user, { downstreamMessageId: userMessage.id });
    }

    const retrieval = await this.rag.retrieve(trimmed, user);
    emit({ type: "rag.retrieved", conversationId, retrieval });

    if (risk.requiresHumanHandoff || retrieval.shouldRefuse) {
      const answer = risk.requiresHumanHandoff
        ? this.refusalMessage(risk.triggers)
        : this.noGroundingMessage(retrieval);
      const assistant = await this.saveAssistantMessage(conversationId, answer, retrieval.sources, {
        auditTags: risk.requiresHumanHandoff
          ? ["risk-detected", "refusal", "human-handoff-suggested", "prompt:sensitive-topic@v1", "trace:local-gateway"]
          : ["no-grounding", "human-handoff-suggested", "prompt:no-answer-refusal@v1", "trace:local-gateway"],
        promptVersion: risk.requiresHumanHandoff ? "sensitive-topic@v1" : "no-answer-refusal@v1",
        latencyMs: Date.now() - startedAt
      });
      emit({ type: "answer.delta", conversationId, delta: answer });
      if (risk.requiresHumanHandoff) {
        await this.requestHumanHandoff(conversationId, user, `Risk triggers: ${risk.triggers.join(", ")}`);
      }
      const summary = await this.completeConversation(conversationId, user, [...conversation.messages, userMessage, assistant], risk.requiresHumanHandoff);
      if (recommendationId) {
        await this.recommendations.recordEvent(conversationId, recommendationId, "answer_completed", user, { downstreamMessageId: userMessage.id });
      }
      emit({ type: "answer.completed", conversationId, conversation: summary });
      return;
    }

    try {
      const result = await this.streamDeepSeekAnswer(conversation, trimmed, retrieval, emit);
      const tags = [
        "rag-grounded",
        "source-recorded",
        "prompt:business-qa@v1",
        `model:${result.model ?? "deepseek-v4-flash"}`,
        `trace:${result.traceId ?? "deepseek-stream"}`,
        `latency:${Date.now() - startedAt}ms`
      ];
      const assistant = await this.saveAssistantMessage(conversationId, result.content, retrieval.sources, {
        auditTags: tags,
        promptVersion: "business-qa@v1",
        modelTraceId: result.traceId,
        tokenUsage: result.tokenUsage,
        latencyMs: Date.now() - startedAt
      });
      await this.audit(user.id, "conversation.message.create", "Conversation", conversationId, "low", {
        modelGateway: "deepseek",
        model: result.model ?? "deepseek-v4-flash",
        promptVersion: "business-qa@v1",
        sourceIds: retrieval.sources.map((source) => source.id),
        latencyMs: Date.now() - startedAt,
        tokenUsage: result.tokenUsage
      });
      const summary = await this.completeConversation(conversationId, user, [...conversation.messages, userMessage, assistant], false);
      if (recommendationId) {
        await this.recommendations.recordEvent(conversationId, recommendationId, "answer_completed", user, { downstreamMessageId: userMessage.id });
      }
      emit({ type: "answer.completed", conversationId, conversation: summary });
    } catch (error) {
      await this.audit(user.id, "conversation.model.error", "Conversation", conversationId, "medium", {
        modelGateway: "deepseek",
        message: error instanceof Error ? error.message : "Unknown model error"
      });
      emit({
        type: "answer.error",
        conversationId,
        message: error instanceof Error ? error.message : "DeepSeek stream failed.",
        retryable: true
      });
      if (recommendationId) {
        await this.recommendations.recordEvent(conversationId, recommendationId, "failed", user, {
          message: error instanceof Error ? error.message : "DeepSeek stream failed."
        });
      }
    }
  }

  async requestHumanHandoff(conversationId: string, user: AuthUser, reason: string) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    const summary = this.summarize(conversation.messages);
    await this.prisma.humanHandoff.create({
      data: {
        conversationId,
        reason,
        summary,
        status: "queued"
      }
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: ConversationStatus.TRANSFERRED_TO_HUMAN,
        humanHandoffReason: reason,
        longSummary: summary
      }
    });
    await this.audit(user.id, "conversation.handoff", "Conversation", conversationId, "medium", { reason, queue: "default-agent-queue" });
    return { conversationId, status: "transferred_to_human", summary, reason };
  }

  async listRecommendations(conversationId: string, user: AuthUser) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    const existing = await this.recommendations.listForConversation(conversationId, user);
    return existing.length ? existing : this.recommendations.generateForConversation(conversation, user);
  }

  async refreshRecommendations(conversationId: string, user: AuthUser) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    return this.recommendations.generateForConversation(conversation, user);
  }

  async recordRecommendationEvent(
    conversationId: string,
    recommendationId: string,
    eventType: RecommendationEventType,
    user: AuthUser,
    metadata?: Record<string, unknown>
  ) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    return this.recommendations.recordEvent(conversationId, recommendationId, eventType, user, metadata);
  }

  async recordSatisfaction(conversationId: string, user: AuthUser, score: "satisfied" | "neutral" | "unsatisfied", messageId?: string) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    await this.prisma.satisfaction.create({
      data: {
        conversationId,
        messageId,
        score
      }
    });
    await this.audit(user.id, "conversation.satisfaction", "Conversation", conversationId, score === "unsatisfied" ? "medium" : "low", {
      score,
      messageId,
      evaluationTag: score === "unsatisfied" ? "needs-review" : "accepted"
    });
    return { conversationId, score, recordedAt: new Date().toISOString(), auditTag: "satisfaction-recorded" };
  }

  streamAssistantAnswer(conversationId: string, user: AuthUser): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void this.getConversation(conversationId, user)
        .then(() => subscriber.complete())
        .catch((error) => subscriber.error(error));
    });
  }

  private async streamDeepSeekAnswer(
    conversation: Awaited<ReturnType<ConversationService["loadConversation"]>>,
    userContent: string,
    retrieval: RagRetrievalResult,
    emit: EmitStreamEvent
  ): Promise<DeepSeekStreamResult> {
    const messages = this.buildPrompt(conversation.messages, userContent, retrieval.sources);
    const iterator = this.llm.streamChat(messages);
    let final: DeepSeekStreamResult = { content: "" };
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        final = next.value;
        break;
      }
      if (next.value.delta) {
        emit({ type: "answer.delta", conversationId: conversation.id, delta: next.value.delta });
      }
    }
    return final;
  }

  private buildPrompt(history: { role: MessageRole; content: string }[], userContent: string, sources: SourceReference[]): ChatMessageInput[] {
    const sourceText = sources
      .map((source, index) => `[${index + 1}] ${source.title} v${source.version ?? 1} (${source.owner}, ${source.sensitivity})\n${source.excerpt}`)
      .join("\n\n");
    const recent = history
      .slice(-6)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    return [
      {
        role: "system",
        content:
          "You are an enterprise/government service assistant. Answer in Chinese. Use only the provided sources for factual claims. Format the answer with: 结论, 办理指引, 所需材料, 注意事项, 来源引用, 人工复核建议. If a section does not apply, write 暂无明确依据. Every important factual claim must cite source numbers like [1]. Do not fabricate policies, deadlines, fees, or eligibility."
      },
      {
        role: "user",
        content: `最近上下文:\n${recent || "无"}\n\n用户问题:\n${userContent}\n\n可用知识来源:\n${sourceText}`
      }
    ];
  }

  private async saveAssistantMessage(
    conversationId: string,
    content: string,
    sources: SourceReference[],
    metadata: {
      auditTags: string[];
      promptVersion: string;
      modelTraceId?: string;
      tokenUsage?: number;
      latencyMs?: number;
    }
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content,
        auditTags: metadata.auditTags,
        promptVersion: metadata.promptVersion,
        modelTraceId: metadata.modelTraceId,
        tokenUsage: metadata.tokenUsage,
        latencyMs: metadata.latencyMs
      }
    });

    for (const source of sources) {
      await this.attachSource(message.id, source);
    }
    return this.prisma.message.findUniqueOrThrow({
      where: { id: message.id },
      include: { sources: { include: { knowledge: true } } }
    });
  }

  private async attachSource(messageId: string, source: SourceReference) {
    const knowledge = await this.prisma.knowledge.findFirst({ where: { id: source.id } });
    if (!knowledge) return;
    await this.prisma.messageSource.create({
      data: {
        messageId,
        knowledgeId: knowledge.id,
        score: source.score,
        excerpt: source.excerpt
      }
    });
  }

  private async completeConversation(
    conversationId: string,
    user: AuthUser,
    messages: { role: MessageRole; content: string }[],
    transferredToHuman: boolean
  ) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: transferredToHuman ? ConversationStatus.TRANSFERRED_TO_HUMAN : ConversationStatus.WAITING_FOR_USER,
        longSummary: this.summarize(messages)
      }
    });
    return this.getConversation(conversationId, user);
  }

  private includeConversation() {
    return {
      user: true,
      messages: {
        orderBy: { createdAt: "asc" as const },
        include: { sources: { include: { knowledge: true } } }
      },
      satisfactions: true,
      humanHandoffs: true
    };
  }

  private async loadConversation(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: this.includeConversation()
    });
    if (!conversation) throw new NotFoundException("Conversation was not found.");
    return conversation;
  }

  private assertCanAccess(conversation: { userId: string | null; status: ConversationStatus }, user: AuthUser) {
    if (user.role === "ADMIN" || user.role === "AUDITOR") return;
    if (
      user.role === "AGENT" &&
      (conversation.status === ConversationStatus.TRANSFERRED_TO_HUMAN || conversation.status === ConversationStatus.HUMAN_PROCESSING)
    ) {
      return;
    }
    if (conversation.userId === user.id) return;
    throw new ForbiddenException("You do not have access to this conversation.");
  }

  private noGroundingMessage(retrieval: RagRetrievalResult) {
    return [
      "结论：暂未检索到足够确定的知识依据，不能直接给出办理结论。",
      "",
      "办理指引：请补充业务类型、主体身份、办理地区、申请事项或受理编号，我会重新检索已发布知识库。",
      "",
      "所需材料：暂无明确依据。",
      "",
      "注意事项：为避免误导，不会基于低置信度结果编造政策、时限或材料清单。",
      "",
      `来源引用：当前最高置信度 ${Math.round(retrieval.confidence * 100)}%。`,
      "",
      "人工复核建议：如事项紧急或涉及审批口径，请转人工客服核验。"
    ].join("\n");
  }

  private refusalMessage(triggers: string[]) {
    return [
      `结论：该问题包含高风险内容（${triggers.join("、")}），已建议人工复核。`,
      "",
      "办理指引：我不能提供可能规避监管、泄露隐私或影响审计完整性的操作建议。",
      "",
      "人工复核建议：请由人工客服结合身份权限、业务记录和合规要求处理。"
    ].join("\n");
  }

  private async toSummary(conversation: Prisma.ConversationGetPayload<{ include: ReturnType<ConversationService["includeConversation"]> }>, user: AuthUser): Promise<ConversationSummary> {
    const messages = conversation.messages.map((message): ChatMessage => this.toChatMessage(message, message.sources));
    const recommendations = await this.recommendations.generateForConversation(conversation, user);
    return {
      conversationId: conversation.id,
      channel: conversation.channel === Channel.WEB_CHAT ? "web-chat" : "mobile-h5",
      status: this.toSharedStatus(conversation.status),
      userDisplayName: conversation.user?.displayName ?? user.displayName,
      shortContext: messages,
      longSummary: conversation.longSummary || this.summarize(conversation.messages),
      recommendations,
      satisfaction: conversation.satisfactions.at(-1)?.score as ConversationSummary["satisfaction"],
      humanHandoffReason: conversation.humanHandoffReason ?? undefined,
      slaDueAt: new Date(conversation.updatedAt.getTime() + 30 * 60 * 1000).toISOString()
    };
  }

  private toChatMessage(
    message: {
      id: string;
      conversationId: string;
      role: MessageRole;
      content: string;
      createdAt: Date;
      auditTags: string[];
      promptVersion?: string | null;
      modelTraceId?: string | null;
      latencyMs?: number | null;
      tokenUsage?: number | null;
    },
    sources: Array<{ score: number; excerpt: string; knowledge: Prisma.KnowledgeGetPayload<Record<string, never>> }>
  ): ChatMessage {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: this.toSharedRole(message.role),
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      auditTags: message.auditTags,
      promptVersion: message.promptVersion ?? message.auditTags.find((tag) => tag.startsWith("prompt:"))?.replace("prompt:", ""),
      modelTraceId: message.modelTraceId ?? message.auditTags.find((tag) => tag.startsWith("trace:"))?.replace("trace:", ""),
      latencyMs: message.latencyMs ?? (Number(message.auditTags.find((tag) => tag.startsWith("latency:"))?.replace(/\D/g, "")) || undefined),
      tokenUsage: message.tokenUsage ?? undefined,
      sources: sources.map((source): SourceReference => ({
        id: source.knowledge.id,
        title: source.knowledge.title,
        type: source.knowledge.type as SourceReference["type"],
        owner: source.knowledge.owner,
        effectiveFrom: source.knowledge.effectiveFrom?.toISOString() ?? source.knowledge.createdAt.toISOString(),
        effectiveTo: source.knowledge.effectiveTo?.toISOString(),
        url: source.knowledge.sourceUrl ?? undefined,
        excerpt: source.excerpt,
        score: source.score,
        version: source.knowledge.version,
        sensitivity: source.knowledge.sensitivity.toLowerCase() as SourceReference["sensitivity"],
        indexStage: "hybrid"
      }))
    };
  }

  private toSharedRole(role: MessageRole): ChatMessage["role"] {
    const map = {
      [MessageRole.USER]: "user",
      [MessageRole.ASSISTANT]: "assistant",
      [MessageRole.HUMAN_AGENT]: "human-agent",
      [MessageRole.SYSTEM]: "system"
    } as const;
    return map[role];
  }

  private toSharedStatus(status: ConversationStatus): ConversationSummary["status"] {
    const map = {
      [ConversationStatus.BOT_PROCESSING]: "bot_processing",
      [ConversationStatus.WAITING_FOR_USER]: "waiting_for_user",
      [ConversationStatus.TRANSFERRED_TO_HUMAN]: "transferred_to_human",
      [ConversationStatus.HUMAN_PROCESSING]: "human_processing",
      [ConversationStatus.CLOSED]: "closed"
    } as const;
    return map[status];
  }

  private summarize(messages: { role: MessageRole; content: string }[]) {
    const userMessages = messages.filter((message) => message.role === MessageRole.USER).map((message) => message.content);
    return userMessages.length ? `最近问题：${userMessages.slice(-3).join(" / ")}` : "尚未开始业务咨询";
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string, riskLevel: string, metadata: Record<string, unknown>) {
    await this.prisma.auditEvent.create({
      data: { actorId, action, resourceType, resourceId, riskLevel, metadata: metadata as Prisma.InputJsonObject }
    });
  }
}
