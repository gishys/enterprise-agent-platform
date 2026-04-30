import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Channel, ConversationStatus, MessageRole, Prisma } from "@prisma/client";
import {
  defaultEntryConfiguration,
  screenRisk,
  type AuthUser,
  type ChatMessage,
  type ConversationSummary,
  type SourceReference
} from "@ai-service/shared";
import { Observable } from "rxjs";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

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
            auditTags: ["welcome", "entry-config", "prompt:base-service-role@v1"]
          }
        }
      },
      include: this.includeConversation()
    });
    await this.audit(user.id, "conversation.create", "Conversation", conversation.id, "low", { channel, department: user.department });
    return this.toSummary(conversation, user.displayName);
  }

  async getConversation(conversationId: string, user: AuthUser): Promise<ConversationSummary> {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    return this.toSummary(conversation, conversation.user?.displayName ?? user.displayName);
  }

  async sendMessage(conversationId: string, content: string, user: AuthUser) {
    const startedAt = Date.now();
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException("消息内容不能为空");
    }

    const risk = screenRisk(trimmed);
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: trimmed,
        auditTags: risk.triggers.length ? ["risk-input"] : []
      }
    });

    const assistant = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: risk.requiresHumanHandoff ? this.refusalMessage(risk.triggers) : this.groundedAnswer(trimmed),
        auditTags: risk.requiresHumanHandoff
          ? ["risk-detected", "refusal", "human-handoff-suggested", "prompt:sensitive-topic@v1", "trace:local-gateway"]
          : ["rag-grounded", "source-recorded", "prompt:business-qa@v1", "trace:local-gateway", `latency:${Date.now() - startedAt}ms`]
      }
    });

    if (!risk.requiresHumanHandoff) {
      await this.attachDefaultSource(assistant.id, trimmed.includes("材料") ? "kb-002" : "kb-001");
    } else {
      await this.requestHumanHandoff(conversationId, user, `高风险内容触发：${risk.triggers.join("、")}`);
    }

    const nextStatus = risk.requiresHumanHandoff ? ConversationStatus.TRANSFERRED_TO_HUMAN : ConversationStatus.WAITING_FOR_USER;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: nextStatus,
        humanHandoffReason: risk.requiresHumanHandoff ? risk.triggers.join("、") : conversation.humanHandoffReason,
        longSummary: this.summarize([...conversation.messages, userMessage, assistant])
      }
    });
    await this.audit(user.id, "conversation.message.create", "Conversation", conversationId, risk.riskLevel, {
      riskTriggers: risk.triggers,
      modelGateway: "local-stub",
      promptVersion: risk.requiresHumanHandoff ? "sensitive-topic@v1" : "business-qa@v1",
      latencyMs: Date.now() - startedAt
    });
    return this.getConversation(conversationId, user);
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
        .then(() => {
          ["正在检索已发布知识库...", "正在执行风险筛查和权限过滤...", "已生成带来源引用的回答。"].forEach((chunk, index) => {
            setTimeout(() => subscriber.next({ data: { conversationId, chunk } } as MessageEvent), index * 250);
          });
          setTimeout(() => subscriber.complete(), 850);
        })
        .catch((error) => subscriber.error(error));
    });
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
    if (!conversation) {
      throw new NotFoundException("会话不存在");
    }
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
    throw new ForbiddenException("无权访问该会话");
  }

  private async attachDefaultSource(messageId: string, knowledgeId: string) {
    const knowledge = await this.prisma.knowledge.findFirst({ where: { id: knowledgeId } });
    if (!knowledge) return;
    await this.prisma.messageSource.create({
      data: {
        messageId,
        knowledgeId: knowledge.id,
        score: knowledgeId === "kb-002" ? 0.88 : 0.93,
        excerpt:
          knowledgeId === "kb-002"
            ? "材料清单应按业务类型、主体身份和属地政策组合生成；缺少条件时应先澄清。"
            : "用户可通过统一服务门户、移动 H5 或人工客服查询业务办理进度，查询前需完成身份校验。"
      }
    });
  }

  private groundedAnswer(content: string) {
    if (content.includes("材料")) {
      return "我已根据材料清单知识库为您匹配到标准答案。请先确认业务类型、主体身份和办理地区；确认后可生成对应材料清单。当前回答已附带来源，若涉及特殊审批或限制级材料，将转人工复核。";
    }
    return "我已基于已发布知识库完成检索。当前事项可先通过统一服务门户或 H5 查询办理进度；如查询结果与实际情况不一致，可转人工客服核验并补充处理记录。";
  }

  private refusalMessage(triggers: string[]) {
    return `该问题包含高风险内容（${triggers.join("、")}）。我不能提供可能规避监管、泄露隐私或影响审计完整性的操作建议，已为您转交人工客服复核。`;
  }

  private toSummary(conversation: Prisma.ConversationGetPayload<{ include: ReturnType<ConversationService["includeConversation"]> }>, userDisplayName: string): ConversationSummary {
    const messages = conversation.messages.map((message): ChatMessage => ({
      id: message.id,
      conversationId: message.conversationId,
      role: this.toSharedRole(message.role),
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      auditTags: message.auditTags,
      promptVersion: message.auditTags.find((tag) => tag.startsWith("prompt:"))?.replace("prompt:", ""),
      modelTraceId: message.auditTags.find((tag) => tag.startsWith("trace:"))?.replace("trace:", ""),
      latencyMs: Number(message.auditTags.find((tag) => tag.startsWith("latency:"))?.replace(/\D/g, "")) || undefined,
      sources: message.sources.map((source): SourceReference => ({
        id: source.knowledge.id,
        title: source.knowledge.title,
        type: source.knowledge.type as SourceReference["type"],
        owner: source.knowledge.owner,
        effectiveFrom: source.knowledge.effectiveFrom?.toISOString() ?? source.knowledge.createdAt.toISOString(),
        url: source.knowledge.sourceUrl ?? undefined,
        excerpt: source.excerpt,
        score: source.score,
        version: source.knowledge.version,
        sensitivity: source.knowledge.sensitivity.toLowerCase() as SourceReference["sensitivity"]
      }))
    }));
    return {
      conversationId: conversation.id,
      channel: conversation.channel === Channel.WEB_CHAT ? "web-chat" : "mobile-h5",
      status: this.toSharedStatus(conversation.status),
      userDisplayName,
      shortContext: messages,
      longSummary: conversation.longSummary || this.summarize(conversation.messages),
      satisfaction: conversation.satisfactions.at(-1)?.score as ConversationSummary["satisfaction"],
      humanHandoffReason: conversation.humanHandoffReason ?? undefined,
      slaDueAt: new Date(conversation.updatedAt.getTime() + 30 * 60 * 1000).toISOString()
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
    return userMessages.length ? `用户最近诉求：${userMessages.slice(-3).join("；")}` : "尚未形成用户诉求摘要";
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string, riskLevel: string, metadata: Record<string, unknown>) {
    await this.prisma.auditEvent.create({
      data: { actorId, action, resourceType, resourceId, riskLevel, metadata: metadata as Prisma.InputJsonObject }
    });
  }
}
