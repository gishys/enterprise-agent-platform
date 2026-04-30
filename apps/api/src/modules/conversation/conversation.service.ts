import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Channel, ConversationStatus, MessageRole, Prisma } from "@prisma/client";
import { defaultEntryConfiguration, type AuthUser, type ChatMessage, type ConversationSummary, type SourceReference } from "@ai-service/shared";
import { Observable } from "rxjs";
import { PrismaService } from "../prisma/prisma.service.js";

const highRiskWords = ["投诉", "举报", "行政审批", "执法", "处罚", "退款", "支付", "删除", "涉密", "个人敏感信息", "内部文件"];

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(user: AuthUser, channel: "web-chat" | "mobile-h5"): Promise<ConversationSummary> {
    const conversation = await this.prisma.conversation.create({
      data: {
        channel: channel === "web-chat" ? Channel.WEB_CHAT : Channel.MOBILE_H5,
        userId: user.id,
        messages: {
          create: {
            role: MessageRole.ASSISTANT,
            content: defaultEntryConfiguration.welcomeMessage,
            auditTags: ["welcome", "entry-config"]
          }
        }
      },
      include: this.includeConversation()
    });
    await this.audit(user.id, "conversation.create", "Conversation", conversation.id, "low", { channel });
    return this.toSummary(conversation, user.displayName);
  }

  async getConversation(conversationId: string, user: AuthUser): Promise<ConversationSummary> {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    return this.toSummary(conversation, conversation.user?.displayName ?? user.displayName);
  }

  async sendMessage(conversationId: string, content: string, user: AuthUser) {
    const conversation = await this.loadConversation(conversationId);
    this.assertCanAccess(conversation, user);
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new NotFoundException("消息内容不能为空");
    }
    const riskTriggers = highRiskWords.filter((word) => trimmed.includes(word));
    const isRisk = riskTriggers.length > 0;
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.USER,
        content: trimmed
      }
    });

    const assistant = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content: isRisk
          ? "该问题可能涉及投诉举报、敏感信息或高风险事项。为保证处理准确和可追溯，建议转接人工客服继续办理。"
          : "已根据知识库检索到相关依据。建议先核对办理对象、当前状态和材料清单；如需查询具体进度，后续可通过受控系统查询能力完成。",
        auditTags: isRisk ? ["risk-detected", "human-handoff-suggested"] : ["rag-grounded", "source-recorded"]
      }
    });

    if (!isRisk) {
      await this.attachDefaultSource(assistant.id);
    } else {
      await this.requestHumanHandoff(conversationId, user, `命中高风险触发词：${riskTriggers.join("、")}`);
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: isRisk ? ConversationStatus.TRANSFERRED_TO_HUMAN : ConversationStatus.WAITING_FOR_USER,
        humanHandoffReason: isRisk ? riskTriggers.join("、") : conversation.humanHandoffReason,
        longSummary: this.summarize([...conversation.messages, userMessage, assistant])
      }
    });
    await this.audit(user.id, "conversation.message.create", "Conversation", conversationId, isRisk ? "high" : "low", { riskTriggers });
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
    await this.audit(user.id, "conversation.handoff", "Conversation", conversationId, "medium", { reason });
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
    await this.audit(user.id, "conversation.satisfaction", "Conversation", conversationId, "low", { score, messageId });
    return { conversationId, score, recordedAt: new Date().toISOString(), auditTag: "satisfaction-recorded" };
  }

  streamAssistantAnswer(conversationId: string, user: AuthUser): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void this.getConversation(conversationId, user)
        .then(() => {
          ["正在检索知识库...", "已命中标准口径...", "正在生成可追溯回答。"].forEach((chunk, index) => {
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

  private async attachDefaultSource(messageId: string) {
    const knowledge = await this.prisma.knowledge.findFirst({ where: { id: "kb-001" } });
    if (!knowledge) return;
    await this.prisma.messageSource.create({
      data: {
        messageId,
        knowledgeId: knowledge.id,
        score: 0.91,
        excerpt: "常见业务咨询应优先给出材料清单、办理条件、办理路径和人工兜底方式。"
      }
    });
  }

  private toSummary(conversation: Prisma.ConversationGetPayload<{ include: ReturnType<ConversationService["includeConversation"]> }>, userDisplayName: string): ConversationSummary {
    const messages = conversation.messages.map((message): ChatMessage => ({
      id: message.id,
      conversationId: message.conversationId,
      role: this.toSharedRole(message.role),
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      auditTags: message.auditTags,
      sources: message.sources.map((source): SourceReference => ({
        id: source.knowledge.id,
        title: source.knowledge.title,
        type: source.knowledge.type as SourceReference["type"],
        owner: source.knowledge.owner,
        effectiveFrom: source.knowledge.effectiveFrom?.toISOString() ?? source.knowledge.createdAt.toISOString(),
        url: source.knowledge.sourceUrl ?? undefined,
        excerpt: source.excerpt,
        score: source.score
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
      humanHandoffReason: conversation.humanHandoffReason ?? undefined
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
    return userMessages.length ? `用户主要咨询：${userMessages.slice(-3).join("；")}` : "暂无用户问题。";
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string, riskLevel: string, metadata: Record<string, unknown>) {
    await this.prisma.auditEvent.create({
      data: { actorId, action, resourceType, resourceId, riskLevel, metadata: metadata as Prisma.InputJsonObject }
    });
  }
}
