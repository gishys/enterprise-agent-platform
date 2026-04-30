import type { AuthUser, ConversationDto, LoginRequest, LoginResponse } from "@ai-service/shared";

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
    const fallback = { message: `请求失败：${response.status}` };
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

export function sendConversationMessage(id: string, content: string) {
  return apiRequest<ConversationDto>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content })
  });
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
