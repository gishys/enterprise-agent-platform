import { Injectable } from "@nestjs/common";
import { Channel, ConversationStatus, MessageRole, Prisma } from "@prisma/client";
import {
  defaultEntryConfiguration,
  screenRisk,
  type AuthUser,
  type RecommendationEventType,
  type RecommendationItem,
  type RecommendationSource,
  type RecommendationType,
  type RiskLevel
} from "@ai-service/shared";
import { LlmService } from "../llm/llm.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const RANKER_VERSION = "hybrid-rules-bandit-ltr@v1";
const PROMPT_VERSION = "recommendation-copy@v1";
const MAX_RECOMMENDATIONS = 3;
const EXPIRES_IN_MS = 10 * 60 * 1000;

type ConversationWithContext = Prisma.ConversationGetPayload<{
  include: {
    user: true;
    messages: { include: { sources: { include: { knowledge: true } } } };
    satisfactions: true;
    humanHandoffs: true;
  };
}>;

interface Candidate {
  type: RecommendationType;
  source: RecommendationSource;
  intent: string;
  label: string;
  payload?: Record<string, unknown>;
  reasonCode: string;
  hardRulePriority: number;
  contextRelevance: number;
  businessPriority: number;
  freshness: number;
  knowledgeConfidence: number;
  riskLevel: RiskLevel;
  knowledgeSensitivity?: string;
  knowledgeEffectiveTo?: Date | null;
  topKnowledgeType?: string;
}

interface RankedCandidate extends Candidate {
  banditArmId?: string;
  banditScore: number;
  modelScore: number;
  profileSimilarity: number;
  explorationBucket: "exploit" | "explore" | "disabled";
  featureSnapshot: Record<string, unknown>;
  score: number;
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService
  ) {}

  private get db() {
    return this.prisma as PrismaService & Record<string, any>;
  }

  async generateForConversation(conversation: ConversationWithContext, user: AuthUser): Promise<RecommendationItem[]> {
    const now = new Date();
    await this.db.recommendation.updateMany({
      where: {
        conversationId: conversation.id,
        status: { in: ["generated", "shown"] },
        expiresAt: { gt: now }
      },
      data: { status: "expired" }
    });

    const candidates = await this.buildCandidates(conversation, user);
    const filtered = this.applyHardFilters(candidates, user);
    const profile = await this.getOrUpdateProfile(user, conversation);
    const ranked = await this.rankCandidates(filtered, conversation, user, profile);
    const selected = await this.rewriteLabelsWithLlm(ranked.slice(0, MAX_RECOMMENDATIONS), conversation, user);
    const expiresAt = new Date(Date.now() + EXPIRES_IN_MS);

    const rows = [];
    for (let index = 0; index < selected.length; index += 1) {
      const candidate = selected[index];
      const created = await this.db.recommendation.create({
        data: {
          conversationId: conversation.id,
          userId: user.id,
          tenantId: conversation.tenantId,
          channel: this.toSharedChannel(conversation.channel),
          type: candidate.type,
          source: candidate.source,
          intent: candidate.intent,
          label: candidate.label,
          payload: (candidate.payload ?? {}) as Prisma.InputJsonObject,
          reasonCode: candidate.reasonCode,
          score: candidate.score,
          rank: index + 1,
          promptVersion: PROMPT_VERSION,
          rankerVersion: RANKER_VERSION,
          banditArmId: candidate.banditArmId,
          featureSnapshot: candidate.featureSnapshot as Prisma.InputJsonObject,
          modelScore: candidate.modelScore,
          explorationBucket: candidate.explorationBucket,
          expiresAt
        }
      });
      rows.push(this.toRecommendationItem(created));
    }

    return rows;
  }

  async listForConversation(conversationId: string, user: AuthUser): Promise<RecommendationItem[]> {
    const rows = await this.db.recommendation.findMany({
      where: {
        conversationId,
        userId: user.id,
        status: { in: ["generated", "shown", "clicked"] },
        expiresAt: { gt: new Date() }
      },
      orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
      take: MAX_RECOMMENDATIONS
    });
    return rows.map((row) => this.toRecommendationItem(row));
  }

  async recordEvent(
    conversationId: string,
    recommendationId: string,
    eventType: RecommendationEventType,
    user: AuthUser,
    metadata: Record<string, unknown> = {}
  ) {
    const recommendation = await this.db.recommendation.findFirst({
      where: { id: recommendationId, conversationId }
    });
    if (!recommendation) {
      await this.audit(user.id, "recommendation.event.missing", "Recommendation", recommendationId, "low", {
        conversationId,
        eventType,
        ...metadata
      });
      return { recorded: false };
    }

    const reward = this.rewardForEvent(eventType);
    await this.db.recommendationEvent.create({
      data: {
        recommendationId: recommendation.id,
        conversationId,
        userId: user.id,
        eventType,
        reward,
        convertedAt: reward >= 0.6 ? new Date() : undefined,
        dwellMs: typeof metadata.dwellMs === "number" ? metadata.dwellMs : undefined,
        downstreamMessageId: typeof metadata.downstreamMessageId === "string" ? metadata.downstreamMessageId : undefined,
        metadata: metadata as Prisma.InputJsonObject
      }
    });

    await this.db.rankingTrainingSample.create({
      data: {
        recommendationId: recommendation.id,
        userId: user.id,
        conversationId,
        featureSnapshot: recommendation.featureSnapshot as Prisma.InputJsonObject,
        label: eventType,
        reward
      }
    });

    await this.updateRecommendationStatus(recommendation.id, eventType);
    await this.updateArmStats(recommendation.banditArmId, this.contextKeyFromSnapshot(recommendation.featureSnapshot), eventType, reward);
    await this.updateProfileFromEvent(user, recommendation.intent, eventType);
    await this.audit(user.id, "recommendation.event", "Recommendation", recommendation.id, "low", {
      eventType,
      reward,
      source: recommendation.source,
      intent: recommendation.intent,
      reasonCode: recommendation.reasonCode,
      channel: recommendation.channel,
      ...metadata
    });

    return { recorded: true, reward };
  }

  private async buildCandidates(conversation: ConversationWithContext, user: AuthUser): Promise<Candidate[]> {
    const lastUserMessage = [...conversation.messages].reverse().find((message) => message.role === MessageRole.USER);
    const lastAssistant = [...conversation.messages].reverse().find((message) => message.role === MessageRole.ASSISTANT);
    const risk = screenRisk(lastUserMessage?.content ?? "");
    const topSource = lastAssistant?.sources?.[0];
    const hasNoGrounding = lastAssistant?.auditTags.includes("no-grounding") ?? false;
    const transferred = conversation.status === ConversationStatus.TRANSFERRED_TO_HUMAN || conversation.status === ConversationStatus.HUMAN_PROCESSING;
    const base: Candidate[] = [];

    if (risk.requiresHumanHandoff || transferred) {
      base.push({
        type: "handoff",
        source: "risk",
        intent: "handoff-human-review",
        label: transferred ? "查看人工处理进度" : "转人工复核",
        reasonCode: risk.requiresHumanHandoff ? "risk-high-human-review" : "conversation-human-processing",
        hardRulePriority: 100,
        contextRelevance: 1,
        businessPriority: 0.8,
        freshness: 1,
        knowledgeConfidence: 0,
        riskLevel: risk.riskLevel
      });
    }

    if (hasNoGrounding || this.confidenceBucket(topSource?.score ?? 0) === "low") {
      base.push({
        type: "clarification",
        source: "conversation",
        intent: "clarify-business-type",
        label: "补充业务类型和地区",
        reasonCode: hasNoGrounding ? "rag-no-grounding" : "rag-low-confidence",
        hardRulePriority: 70,
        contextRelevance: 0.95,
        businessPriority: 0.6,
        freshness: 1,
        knowledgeConfidence: topSource?.score ?? 0,
        riskLevel: risk.riskLevel,
        topKnowledgeType: topSource?.knowledge.type
      });
    }

    if (topSource) {
      base.push({
        type: "question",
        source: "knowledge",
        intent: this.intentFromKnowledgeType(topSource.knowledge.type),
        label: this.labelFromKnowledge(topSource.knowledge.title, topSource.knowledge.type),
        payload: { knowledgeId: topSource.knowledge.id, title: topSource.knowledge.title },
        reasonCode: "rag-top-source-follow-up",
        hardRulePriority: 20,
        contextRelevance: 0.85,
        businessPriority: 0.55,
        freshness: this.freshness(topSource.knowledge.effectiveFrom),
        knowledgeConfidence: topSource.score,
        riskLevel: risk.riskLevel,
        knowledgeSensitivity: topSource.knowledge.sensitivity,
        knowledgeEffectiveTo: topSource.knowledge.effectiveTo,
        topKnowledgeType: topSource.knowledge.type
      });
    }

    for (const question of defaultEntryConfiguration.quickQuestions) {
      base.push({
        type: question.includes("人工") ? "handoff" : "question",
        source: "business-config",
        intent: this.intentFromText(question),
        label: question,
        reasonCode: "entry-config-default",
        hardRulePriority: 10,
        contextRelevance: this.textMatches(lastUserMessage?.content ?? "", question) ? 0.8 : 0.35,
        businessPriority: 0.75,
        freshness: 0.9,
        knowledgeConfidence: 0,
        riskLevel: risk.riskLevel
      });
    }

    base.push(
      {
        type: "action",
        source: "business-config",
        intent: "progress-query",
        label: "查询办理进度",
        reasonCode: "service-catalog-progress",
        hardRulePriority: 10,
        contextRelevance: this.textMatches(lastUserMessage?.content ?? "", "进度 查询 办理") ? 0.9 : 0.45,
        businessPriority: 0.85,
        freshness: 0.9,
        knowledgeConfidence: 0,
        riskLevel: risk.riskLevel
      },
      {
        type: "question",
        source: "fallback",
        intent: "material-checklist",
        label: "需要哪些材料",
        reasonCode: "service-catalog-materials",
        hardRulePriority: 5,
        contextRelevance: this.textMatches(lastUserMessage?.content ?? "", "材料 清单") ? 0.9 : 0.4,
        businessPriority: 0.8,
        freshness: 0.9,
        knowledgeConfidence: 0,
        riskLevel: risk.riskLevel
      }
    );

    return base;
  }

  private applyHardFilters(candidates: Candidate[], user: AuthUser) {
    const now = new Date();
    const allowedSensitivities = this.allowedSensitivities(user);
    return candidates.filter((candidate) => {
      if (candidate.riskLevel === "high" && !["handoff", "clarification"].includes(candidate.type)) return false;
      if (candidate.knowledgeSensitivity && !allowedSensitivities.includes(candidate.knowledgeSensitivity.toUpperCase())) return false;
      if (candidate.knowledgeEffectiveTo && candidate.knowledgeEffectiveTo < now) return false;
      return true;
    });
  }

  private async rankCandidates(
    candidates: Candidate[],
    conversation: ConversationWithContext,
    user: AuthUser,
    profile: { vector: number[]; recentIntents: string[]; negativeIntents: string[] }
  ): Promise<RankedCandidate[]> {
    const contextKey = this.contextKey(conversation, user, candidates);
    const deduped = this.dedupeByIntent(candidates);
    const ranked: RankedCandidate[] = [];
    for (const candidate of deduped) {
      const arm = await this.ensureArm(candidate);
      const stat = arm
        ? await this.db.recommendationArmStat.upsert({
            where: { armId_contextKey: { armId: arm.id, contextKey } },
            update: {},
            create: {
              armId: arm.id,
              contextKey,
              alpha: arm.priorAlpha,
              beta: arm.priorBeta
            }
          })
        : undefined;
      const explorationBucket = this.explorationBucket(candidate.riskLevel, conversation.status);
      const banditScore = stat ? this.thompsonSample(stat.alpha, stat.beta) : 0.5;
      const profileSimilarity = this.profileSimilarity(profile, candidate);
      const modelScore = await this.shadowModelScore(candidate, profileSimilarity, banditScore);
      const featureSnapshot = {
        rankerVersion: RANKER_VERSION,
        contextKey,
        channel: this.toSharedChannel(conversation.channel),
        role: user.role,
        department: user.department,
        conversationStatus: this.toSharedStatus(conversation.status),
        riskLevel: candidate.riskLevel,
        topKnowledgeType: candidate.topKnowledgeType,
        confidenceBucket: this.confidenceBucket(candidate.knowledgeConfidence),
        profileSimilarity,
        banditScore,
        modelScore,
        businessPriority: candidate.businessPriority,
        source: candidate.source,
        intent: candidate.intent,
        type: candidate.type
      };

      ranked.push({
        ...candidate,
        banditArmId: arm?.id,
        banditScore,
        modelScore,
        profileSimilarity,
        explorationBucket,
        featureSnapshot,
        score:
          candidate.hardRulePriority +
          modelScore * 0.45 +
          banditScore * 0.25 +
          profileSimilarity * 0.15 +
          candidate.businessPriority * 0.1 +
          candidate.freshness * 0.05
      });
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  private async rewriteLabelsWithLlm(candidates: RankedCandidate[], conversation: ConversationWithContext, user: AuthUser) {
    const rewritten: RankedCandidate[] = [];
    for (const candidate of candidates) {
      const label = await this.rewriteLabel(candidate, conversation, user).catch(() => candidate.label);
      rewritten.push({ ...candidate, label: this.sanitizeLabel(label, candidate.label, candidate.riskLevel) });
    }
    return rewritten;
  }

  private async rewriteLabel(candidate: RankedCandidate, conversation: ConversationWithContext, user: AuthUser) {
    const lastUserMessage = [...conversation.messages].reverse().find((message) => message.role === MessageRole.USER)?.content ?? "";
    const prompt = [
      {
        role: "system" as const,
        content:
          "You rewrite recommendation chip labels for a government/enterprise service chatbot. Return strict JSON only: {\"label\":\"...\"}. The label must be Chinese, <=18 Chinese characters, action-oriented, and must not assert policy facts. High risk may only ask for clarification or human review."
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          currentLabel: candidate.label,
          intent: candidate.intent,
          type: candidate.type,
          reasonCode: candidate.reasonCode,
          riskLevel: candidate.riskLevel,
          userRole: user.role,
          channel: this.toSharedChannel(conversation.channel),
          recentQuestion: lastUserMessage,
          knowledge: candidate.payload
        })
      }
    ];

    const iterator = this.llm.streamChat(prompt);
    let result = "";
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        result = next.value.content;
        break;
      }
    }
    const parsed = JSON.parse(result) as { label?: string };
    return parsed.label ?? candidate.label;
  }

  private sanitizeLabel(label: string, fallback: string, riskLevel: RiskLevel) {
    const cleaned = label.replace(/[{}[\]"']/g, "").trim();
    if (!cleaned || cleaned.length > 24) return fallback;
    if (riskLevel === "high" && !/(人工|复核|补充|说明|澄清)/.test(cleaned)) return fallback;
    if (/(一定|必须通过|保证|直接办理成功|无需审核)/.test(cleaned)) return fallback;
    return cleaned;
  }

  private async getOrUpdateProfile(user: AuthUser, conversation: ConversationWithContext) {
    const intents = conversation.messages
      .filter((message) => message.role === MessageRole.USER)
      .slice(-6)
      .map((message) => this.intentFromText(message.content));
    const existing = await this.db.userInterestProfile.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: "default" } }
    });
    const recentIntents = this.unique([...(this.asStringArray(existing?.recentIntents).slice(-8) ?? []), ...intents]).slice(-10);
    const vector = this.embeddingFromIntents(recentIntents);
    await this.db.userInterestProfile.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: "default" } },
      update: {
        department: user.department,
        role: user.role,
        interestVector: vector,
        recentIntents,
        frequentIntents: this.frequentIntents(recentIntents),
        lastInteractionAt: new Date()
      },
      create: {
        userId: user.id,
        tenantId: "default",
        department: user.department,
        role: user.role,
        interestVector: vector,
        recentIntents,
        frequentIntents: this.frequentIntents(recentIntents),
        negativeIntents: [],
        lastInteractionAt: new Date()
      }
    });
    return {
      vector,
      recentIntents,
      negativeIntents: this.asStringArray(existing?.negativeIntents)
    };
  }

  private async updateProfileFromEvent(user: AuthUser, intent: string, eventType: RecommendationEventType) {
    const existing = await this.db.userInterestProfile.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: "default" } }
    });
    const recent = this.asStringArray(existing?.recentIntents);
    const negative = this.asStringArray(existing?.negativeIntents);
    const nextRecent = ["click", "sent", "converted", "satisfied"].includes(eventType) ? this.unique([...recent, intent]).slice(-10) : recent;
    const nextNegative = ["dismiss", "unsatisfied", "failed"].includes(eventType) ? this.unique([...negative, intent]).slice(-10) : negative;
    await this.db.userInterestProfile.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: "default" } },
      update: {
        recentIntents: nextRecent,
        negativeIntents: nextNegative,
        interestVector: this.embeddingFromIntents(nextRecent),
        frequentIntents: this.frequentIntents(nextRecent),
        lastInteractionAt: new Date()
      },
      create: {
        userId: user.id,
        tenantId: "default",
        department: user.department,
        role: user.role,
        interestVector: this.embeddingFromIntents(nextRecent),
        frequentIntents: this.frequentIntents(nextRecent),
        recentIntents: nextRecent,
        negativeIntents: nextNegative,
        lastInteractionAt: new Date()
      }
    });
  }

  private async ensureArm(candidate: Candidate) {
    return this.db.recommendationArm.upsert({
      where: {
        tenantId_intent_strategy: {
          tenantId: "default",
          intent: candidate.intent,
          strategy: candidate.source
        }
      },
      update: {},
      create: {
        tenantId: "default",
        name: candidate.intent,
        strategy: candidate.source,
        source: candidate.source,
        intent: candidate.intent,
        priorAlpha: candidate.type === "handoff" ? 2 : 1,
        priorBeta: 2
      }
    });
  }

  private async updateArmStats(armId: string | null, contextKey: string, eventType: RecommendationEventType, reward: number) {
    if (!armId) return;
    const increments = {
      impressions: eventType === "impression" ? 1 : 0,
      clicks: eventType === "click" ? 1 : 0,
      sends: eventType === "sent" ? 1 : 0,
      conversions: ["converted", "satisfied", "answer_completed"].includes(eventType) ? 1 : 0,
      dismisses: ["dismiss", "unsatisfied", "failed"].includes(eventType) ? 1 : 0
    };
    await this.db.recommendationArmStat.upsert({
      where: { armId_contextKey: { armId, contextKey } },
      update: {
        impressions: { increment: increments.impressions },
        clicks: { increment: increments.clicks },
        sends: { increment: increments.sends },
        conversions: { increment: increments.conversions },
        dismisses: { increment: increments.dismisses },
        alpha: { increment: Math.max(0, reward) },
        beta: { increment: Math.max(0, 1 - reward) }
      },
      create: {
        armId,
        contextKey,
        impressions: increments.impressions,
        clicks: increments.clicks,
        sends: increments.sends,
        conversions: increments.conversions,
        dismisses: increments.dismisses,
        alpha: 1 + Math.max(0, reward),
        beta: 1 + Math.max(0, 1 - reward)
      }
    });
  }

  private async updateRecommendationStatus(id: string, eventType: RecommendationEventType) {
    const statusByEvent: Partial<Record<RecommendationEventType, string>> = {
      impression: "shown",
      click: "clicked",
      sent: "sent",
      dismiss: "dismissed",
      failed: "blocked",
      converted: "converted",
      blocked: "blocked"
    };
    const status = statusByEvent[eventType];
    if (status) await this.db.recommendation.update({ where: { id }, data: { status } });
  }

  private rewardForEvent(eventType: RecommendationEventType) {
    const rewards: Record<RecommendationEventType, number> = {
      impression: 0,
      click: 0.2,
      sent: 0.4,
      answer_completed: 0.6,
      satisfied: 1,
      handoff_needed_after_recommendation: -0.3,
      dismiss: -0.2,
      unsatisfied: -0.6,
      failed: -0.2,
      converted: 1,
      blocked: -0.4
    };
    return rewards[eventType] ?? 0;
  }

  private async shadowModelScore(candidate: Candidate, profileSimilarity: number, banditScore: number) {
    const active = await this.db.rankingModelVersion.findFirst({
      where: { modelType: "recommendation-ltr", status: { in: ["shadow", "active"] } },
      orderBy: { createdAt: "desc" }
    });
    const metrics = (active?.metrics ?? {}) as { weights?: Record<string, number> };
    const weights = metrics.weights ?? {};
    return Math.max(
      0,
      Math.min(
        1,
        (weights.contextRelevance ?? 0.35) * candidate.contextRelevance +
          (weights.profileSimilarity ?? 0.2) * profileSimilarity +
          (weights.knowledgeConfidence ?? 0.2) * candidate.knowledgeConfidence +
          (weights.banditScore ?? 0.15) * banditScore +
          (weights.businessPriority ?? 0.1) * candidate.businessPriority
      )
    );
  }

  private explorationBucket(riskLevel: RiskLevel, status: ConversationStatus): "exploit" | "explore" | "disabled" {
    if (riskLevel === "high" || status === ConversationStatus.TRANSFERRED_TO_HUMAN || status === ConversationStatus.HUMAN_PROCESSING) return "disabled";
    return Math.random() < 0.1 ? "explore" : "exploit";
  }

  private profileSimilarity(profile: { vector: number[]; recentIntents: string[]; negativeIntents: string[] }, candidate: Candidate) {
    if (profile.negativeIntents.includes(candidate.intent)) return 0;
    const candidateVector = this.embeddingFromIntents([candidate.intent]);
    const dot = profile.vector.reduce((sum, value, index) => sum + value * (candidateVector[index] ?? 0), 0);
    const left = Math.sqrt(profile.vector.reduce((sum, value) => sum + value * value, 0));
    const right = Math.sqrt(candidateVector.reduce((sum, value) => sum + value * value, 0));
    if (!left || !right) return profile.recentIntents.includes(candidate.intent) ? 0.7 : 0.35;
    return Math.max(0, Math.min(1, dot / (left * right)));
  }

  private embeddingFromIntents(intents: string[]) {
    const vector = Array.from({ length: 16 }, () => 0);
    intents.forEach((intent, intentIndex) => {
      const weight = 1 + intentIndex / Math.max(1, intents.length);
      for (let i = 0; i < intent.length; i += 1) {
        vector[(intent.charCodeAt(i) + i) % vector.length] += weight;
      }
    });
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / norm).toFixed(6)));
  }

  private thompsonSample(alpha: number, beta: number) {
    const a = this.gammaSample(Math.max(0.1, alpha));
    const b = this.gammaSample(Math.max(0.1, beta));
    return a / (a + b);
  }

  private gammaSample(shape: number): number {
    if (shape < 1) return this.gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      const x = this.normalSample();
      const v = Math.pow(1 + c * x, 3);
      if (v <= 0) continue;
      const u = Math.random();
      if (u < 1 - 0.0331 * Math.pow(x, 4)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  private normalSample(): number {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private dedupeByIntent(candidates: Candidate[]) {
    const byIntent = new Map<string, Candidate>();
    for (const candidate of candidates) {
      const existing = byIntent.get(candidate.intent);
      if (!existing || candidate.hardRulePriority + candidate.contextRelevance > existing.hardRulePriority + existing.contextRelevance) {
        byIntent.set(candidate.intent, candidate);
      }
    }
    return [...byIntent.values()];
  }

  private intentFromText(text: string) {
    if (/人工|客服|复核/.test(text)) return "handoff-human-review";
    if (/材料|清单/.test(text)) return "material-checklist";
    if (/进度|办理/.test(text)) return "progress-query";
    if (/政策|条件|适用/.test(text)) return "policy-condition-followup";
    if (/投诉|举报|风险/.test(text)) return "complaint-risk-review";
    return "general-service-question";
  }

  private intentFromKnowledgeType(type: string) {
    if (type === "policy") return "policy-condition-followup";
    if (type === "process") return "progress-query";
    if (type === "standard-answer") return "material-checklist";
    if (type === "faq") return "faq-followup";
    return "knowledge-followup";
  }

  private labelFromKnowledge(title: string, type: string) {
    if (type === "policy") return "继续了解适用条件";
    if (type === "process") return "查看办理流程";
    if (type === "standard-answer") return "生成材料清单";
    return title.length > 14 ? `${title.slice(0, 13)}…` : title;
  }

  private textMatches(source: string, target: string) {
    const terms = target.split(/\s+|、|，|,|？|\?/).filter(Boolean);
    if (!source || !terms.length) return false;
    return terms.some((term) => source.includes(term));
  }

  private freshness(date?: Date | null) {
    if (!date) return 0.6;
    const days = (Date.now() - date.getTime()) / 86400000;
    return Math.max(0.2, Math.min(1, 1 - days / 730));
  }

  private confidenceBucket(score: number) {
    if (score >= 0.75) return "high";
    if (score >= 0.55) return "medium";
    return "low";
  }

  private contextKey(conversation: ConversationWithContext, user: AuthUser, candidates: Candidate[]) {
    const top = candidates.find((candidate) => candidate.topKnowledgeType);
    const risk = candidates.some((candidate) => candidate.riskLevel === "high") ? "high" : "low";
    return [
      this.toSharedChannel(conversation.channel),
      user.role,
      user.department ?? "none",
      this.toSharedStatus(conversation.status),
      risk,
      top?.topKnowledgeType ?? "none",
      this.confidenceBucket(Math.max(...candidates.map((candidate) => candidate.knowledgeConfidence), 0))
    ].join("|");
  }

  private contextKeyFromSnapshot(snapshot: Prisma.JsonValue) {
    if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && typeof snapshot.contextKey === "string") {
      return snapshot.contextKey;
    }
    return "unknown";
  }

  private allowedSensitivities(user: AuthUser) {
    if (user.role === "ADMIN" || user.role === "AUDITOR") return ["PUBLIC", "INTERNAL", "SENSITIVE", "RESTRICTED"];
    if (user.role === "AGENT") return ["PUBLIC", "INTERNAL", "SENSITIVE"];
    return ["PUBLIC", "INTERNAL"];
  }

  private frequentIntents(intents: string[]) {
    const counts = new Map<string, number>();
    intents.forEach((intent) => counts.set(intent, (counts.get(intent) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({ intent, count }));
  }

  private unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }

  private toRecommendationItem(row: {
    id: string;
    label: string;
    type: string;
    source: string;
    intent: string;
    payload: Prisma.JsonValue;
    score: number;
    rank: number;
    reasonCode: string;
    expiresAt: Date;
    rankerVersion: string;
    banditArmId: string | null;
    modelScore: number | null;
    explorationBucket: string | null;
  }): RecommendationItem {
    return {
      id: row.id,
      trackingId: row.id,
      label: row.label,
      type: row.type as RecommendationType,
      source: row.source as RecommendationSource,
      intent: row.intent,
      payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Record<string, unknown>) : undefined,
      score: Number(row.score.toFixed(4)),
      rank: row.rank,
      reasonCode: row.reasonCode,
      expiresAt: row.expiresAt.toISOString(),
      rankerVersion: row.rankerVersion,
      banditArmId: row.banditArmId ?? undefined,
      modelScore: row.modelScore ?? undefined,
      explorationBucket: row.explorationBucket as RecommendationItem["explorationBucket"]
    };
  }

  private toSharedChannel(channel: Channel) {
    return channel === Channel.WEB_CHAT ? "web-chat" : "mobile-h5";
  }

  private toSharedStatus(status: ConversationStatus) {
    const map = {
      [ConversationStatus.BOT_PROCESSING]: "bot_processing",
      [ConversationStatus.WAITING_FOR_USER]: "waiting_for_user",
      [ConversationStatus.TRANSFERRED_TO_HUMAN]: "transferred_to_human",
      [ConversationStatus.HUMAN_PROCESSING]: "human_processing",
      [ConversationStatus.CLOSED]: "closed"
    } as const;
    return map[status];
  }

  private async audit(actorId: string, action: string, resourceType: string, resourceId: string, riskLevel: string, metadata: Record<string, unknown>) {
    await this.prisma.auditEvent.create({
      data: { actorId, action, resourceType, resourceId, riskLevel, metadata: metadata as Prisma.InputJsonObject }
    });
  }
}
