import type {
  AgentConversationItem,
  AuditEvent,
  AuthUser,
  ChatStreamEvent,
  ConversationDto,
  EvaluationRun,
  KnowledgeItem,
  KnowledgeUploadJob,
  LoginRequest,
  LoginResponse,
  OperationsDashboard,
  RecommendationEventType,
  RecommendationItem
} from "@ai-service/shared";

let accessToken: string | undefined;

export function setAccessToken(token: string | undefined) {
  accessToken = token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshSession().catch(() => undefined);
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    const fallback = { message: `Request failed with ${response.status}` };
    const payload = await response.json().catch(() => fallback);
    throw new Error(payload.message ?? fallback.message);
  }

  return response.json() as Promise<T>;
}

export async function login(payload: LoginRequest) {
  const result = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  }, false);
  setAccessToken(result.accessToken);
  return result;
}

export async function refreshSession() {
  const result = await apiRequest<LoginResponse>("/auth/refresh", { method: "POST" }, false);
  setAccessToken(result.accessToken);
  return result;
}

export async function logout() {
  await apiRequest<{ success: boolean }>("/auth/logout", { method: "POST" }, false).catch(() => undefined);
  setAccessToken(undefined);
}

export function me() {
  return apiRequest<{ user: AuthUser }>("/auth/me");
}

export function createConversation(channel: "web-chat" | "mobile-h5") {
  return apiRequest<ConversationDto>("/conversations", {
    method: "POST",
    body: JSON.stringify({ channel })
  });
}

export function getConversation(id: string) {
  return apiRequest<ConversationDto>(`/conversations/${id}`);
}

export function sendConversationMessage(id: string, content: string, recommendationId?: string) {
  return apiRequest<ConversationDto>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, recommendationId })
  });
}

export async function streamConversationMessage(
  id: string,
  content: string,
  onEvent: (event: ChatStreamEvent) => void,
  recommendationId?: string
) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "text/event-stream");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`/api/conversations/${id}/messages/stream`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ content, recommendationId })
  });

  if (!response.ok || !response.body) {
    const fallback = { message: `Request failed with ${response.status}` };
    const payload = await response.json().catch(() => fallback);
    throw new Error(payload.message ?? fallback.message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";
    for (const rawEvent of events) {
      const dataLine = rawEvent.split(/\r?\n/).find((line) => line.startsWith("data:"));
      if (dataLine) {
        onEvent(JSON.parse(dataLine.slice(5).trim()) as ChatStreamEvent);
      }
    }
  }
}

export function requestHumanHandoff(id: string, reason?: string) {
  return apiRequest<{ conversationId: string; status: string; summary: string; reason: string }>(`/conversations/${id}/handoff`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function rateConversation(id: string, score: "satisfied" | "neutral" | "unsatisfied", messageId?: string) {
  return apiRequest<{ conversationId: string; score: string; recordedAt: string }>(`/conversations/${id}/satisfaction`, {
    method: "POST",
    body: JSON.stringify({ score, messageId })
  });
}

export function listRecommendations(id: string) {
  return apiRequest<RecommendationItem[]>(`/conversations/${id}/recommendations`);
}

export function recordRecommendationEvent(
  conversationId: string,
  recommendationId: string,
  eventType: RecommendationEventType,
  metadata?: Record<string, unknown>
) {
  return apiRequest<{ recorded: boolean; reward?: number }>(`/conversations/${conversationId}/recommendations/${recommendationId}/events`, {
    method: "POST",
    body: JSON.stringify({ eventType, metadata })
  });
}

export function listKnowledge() {
  return apiRequest<KnowledgeItem[]>("/knowledge");
}

export function createKnowledgeUpload(fileName: string) {
  return apiRequest<KnowledgeUploadJob>("/knowledge/uploads", {
    method: "POST",
    body: JSON.stringify({ fileName })
  });
}

export function listAgentConversations() {
  return apiRequest<AgentConversationItem[]>("/agent/conversations");
}

export function getOperationsDashboard() {
  return apiRequest<OperationsDashboard>("/operations/dashboard");
}

export function listEvaluationRuns() {
  return apiRequest<EvaluationRun[]>("/evaluations/runs");
}

export function listAuditEvents() {
  return apiRequest<AuditEvent[]>("/audit-events");
}
