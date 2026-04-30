export type Channel = "web-chat" | "mobile-h5";

export type UserRole = "USER" | "AGENT" | "ADMIN" | "AUDITOR";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  department?: string | null;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export type ConversationStatus =
  | "bot_processing"
  | "waiting_for_user"
  | "transferred_to_human"
  | "human_processing"
  | "closed";

export type MessageRole = "user" | "assistant" | "human-agent" | "system";

export type KnowledgeType =
  | "faq"
  | "business-rule"
  | "operation-manual"
  | "policy"
  | "product"
  | "incident"
  | "process"
  | "standard-answer";

export type SensitivityLevel = "public" | "internal" | "sensitive" | "restricted";

export type KnowledgeStatus = "draft" | "reviewing" | "published" | "expired" | "archived";

export type PromptTemplateKind =
  | "base-service-role"
  | "business-qa"
  | "system-operation"
  | "no-answer-refusal"
  | "multi-turn-clarification"
  | "complaint-calming"
  | "human-handoff"
  | "policy-standard-answer"
  | "sensitive-topic"
  | "satisfaction-follow-up";

export interface SourceReference {
  id: string;
  title: string;
  type: KnowledgeType;
  owner: string;
  effectiveFrom: string;
  url?: string;
  excerpt: string;
  score: number;
  version?: number;
  sensitivity?: SensitivityLevel;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  sources?: SourceReference[];
  auditTags?: string[];
  modelTraceId?: string;
  promptVersion?: string;
  latencyMs?: number;
  tokenUsage?: number;
}

export type MessageDto = ChatMessage;

export interface ConversationSummary {
  conversationId: string;
  channel: Channel;
  status: ConversationStatus;
  userDisplayName: string;
  shortContext: ChatMessage[];
  longSummary: string;
  satisfaction?: "satisfied" | "neutral" | "unsatisfied";
  humanHandoffReason?: string;
  slaDueAt?: string;
  closedReason?: string;
}

export type ConversationDto = ConversationSummary;

export interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  owner: string;
  status: KnowledgeStatus;
  sensitivity: SensitivityLevel;
  effectiveFrom: string;
  version: number;
  sourceFile?: string;
  chunkCount?: number;
  indexStatus?: "queued" | "parsing" | "indexed" | "failed";
  updatedAt?: string;
}

export interface KnowledgeUploadJob {
  id: string;
  fileName: string;
  status: "queued" | "parsing" | "chunking" | "embedding" | "indexed" | "failed";
  steps: Array<{ name: string; status: "done" | "running" | "pending" | "failed" }>;
  createdAt: string;
}

export interface OperationsDashboard {
  knowledgeHitRate: number;
  noAnswerRate: number;
  humanHandoffRate: number;
  satisfaction: number;
  averageResponseMs: number;
  unresolvedQuestions: number;
  evaluationPassRate: number;
}

export interface AgentConversationItem {
  conversationId: string;
  customerName: string;
  status: ConversationStatus;
  priority: "normal" | "urgent" | "risk";
  slaDueAt: string;
  summary: string;
  lastMessage: string;
}

export interface EvaluationRun {
  id: string;
  name: string;
  status: "passed" | "warning" | "failed";
  score: number;
  sampleSize: number;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  riskLevel: "low" | "medium" | "high";
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
}

export interface EntryConfiguration {
  botName: string;
  botAvatar: string;
  welcomeMessage: string;
  quickQuestions: string[];
  humanServiceAvailable: boolean;
  humanServiceHint: string;
}
