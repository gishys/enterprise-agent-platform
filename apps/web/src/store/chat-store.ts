import { create } from "zustand";
import type { Channel, ChatMessage, ConversationStatus, RagRetrievalResult, RecommendationEventType, RecommendationItem } from "@ai-service/shared";
import * as api from "../api/client";

interface ChatState {
  activeView: "web" | "h5" | "agent" | "admin";
  conversationId?: string;
  status: ConversationStatus;
  messages: ChatMessage[];
  recommendations: RecommendationItem[];
  loading: boolean;
  error?: string;
  setActiveView: (view: ChatState["activeView"]) => void;
  startConversation: (channel: Channel) => Promise<void>;
  sendMessage: (content: string, recommendationId?: string) => Promise<void>;
  requestHuman: () => Promise<void>;
  rateLastAnswer: (score: "satisfied" | "neutral" | "unsatisfied") => Promise<void>;
  recordRecommendationEvent: (recommendationId: string, eventType: RecommendationEventType, metadata?: Record<string, unknown>) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeView: "web",
  status: "waiting_for_user",
  messages: [],
  recommendations: [],
  loading: false,
  setActiveView: (activeView) => set({ activeView }),
  startConversation: async (channel) => {
    set({ loading: true, error: undefined });
    try {
      const conversation = await api.createConversation(channel);
      set({
        conversationId: conversation.conversationId,
        status: conversation.status,
        messages: conversation.shortContext,
        recommendations: conversation.recommendations ?? [],
        loading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "创建会话失败", loading: false });
    }
  },
  sendMessage: async (content, recommendationId) => {
    const state = get();
    if (!state.conversationId) {
      await get().startConversation(state.activeView === "h5" ? "mobile-h5" : "web-chat");
    }
    const conversationId = get().conversationId;
    if (!conversationId) return;

    set({ loading: true, error: undefined, recommendations: [] });
    const pendingAssistantId = `stream-${Date.now()}`;
    const appendPendingAssistant = (retrieval: RagRetrievalResult) => {
      if (get().messages.some((message) => message.id === pendingAssistantId)) return;
      const pending: ChatMessage = {
        id: pendingAssistantId,
        conversationId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        sources: retrieval.sources,
        auditTags: ["rag-grounded", "streaming", "model:deepseek-v4-flash"],
        promptVersion: "business-qa@v1"
      };
      set({ messages: [...get().messages, pending] });
    };

    try {
      await api.streamConversationMessage(conversationId, content, (event) => {
        if (event.type === "message.created") {
          set({ messages: [...get().messages, event.message] });
        }
        if (event.type === "rag.retrieved") {
          appendPendingAssistant(event.retrieval);
        }
        if (event.type === "answer.delta") {
          set({
            messages: get().messages.map((message) =>
              message.id === pendingAssistantId ? { ...message, content: `${message.content}${event.delta}` } : message
            )
          });
        }
        if (event.type === "answer.completed") {
          set({
            status: event.conversation.status,
            messages: event.conversation.shortContext,
            recommendations: event.conversation.recommendations ?? [],
            loading: false
          });
        }
        if (event.type === "answer.error") {
          set({ error: event.message, loading: false });
        }
      }, recommendationId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "消息发送失败", loading: false });
    }
  },
  requestHuman: async () => {
    const { conversationId } = get();
    if (!conversationId) return;
    set({ loading: true, error: undefined });
    try {
      await api.requestHumanHandoff(conversationId, "用户主动请求人工客服");
      const conversation = await api.getConversation(conversationId);
      set({ status: conversation.status, messages: conversation.shortContext, recommendations: conversation.recommendations ?? [], loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "转人工失败", loading: false });
    }
  },
  rateLastAnswer: async (score) => {
    const { conversationId, messages } = get();
    if (!conversationId) return;
    const lastAnswer = [...messages].reverse().find((message) => message.role === "assistant");
    try {
      await api.rateConversation(conversationId, score, lastAnswer?.id);
      const eventType = score === "satisfied" ? "satisfied" : score === "unsatisfied" ? "unsatisfied" : undefined;
      const recommendation = get().recommendations[0];
      if (eventType && recommendation) {
        await api.recordRecommendationEvent(conversationId, recommendation.id, eventType, { messageId: lastAnswer?.id }).catch(() => undefined);
      }
      set({ error: undefined });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "满意度提交失败" });
    }
  },
  recordRecommendationEvent: async (recommendationId, eventType, metadata) => {
    const { conversationId } = get();
    if (!conversationId) return;
    await api.recordRecommendationEvent(conversationId, recommendationId, eventType, metadata).catch(() => undefined);
  }
}));
