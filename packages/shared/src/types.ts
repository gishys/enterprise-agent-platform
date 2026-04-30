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
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  sources?: SourceReference[];
  auditTags?: string[];
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
}

export type ConversationDto = ConversationSummary;

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
