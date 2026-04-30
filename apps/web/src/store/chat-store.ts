import { create } from "zustand";
import type { Channel, ChatMessage, ConversationStatus } from "@ai-service/shared";
import * as api from "../api/client";

interface ChatState {
  activeView: "web" | "h5" | "agent" | "admin";
  conversationId?: string;
  status: ConversationStatus;
  messages: ChatMessage[];
  loading: boolean;
  error?: string;
  setActiveView: (view: ChatState["activeView"]) => void;
  startConversation: (channel: Channel) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  requestHuman: () => Promise<void>;
  rateLastAnswer: (score: "satisfied" | "neutral" | "unsatisfied") => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeView: "web",
  status: "waiting_for_user",
  messages: [],
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
        loading: false
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "创建会话失败", loading: false });
    }
  },
  sendMessage: async (content) => {
    const state = get();
    if (!state.conversationId) {
      await get().startConversation(state.activeView === "h5" ? "mobile-h5" : "web-chat");
    }
    const conversationId = get().conversationId;
    if (!conversationId) return;
    set({ loading: true, error: undefined });
    try {
      const conversation = await api.sendConversationMessage(conversationId, content);
      set({ status: conversation.status, messages: conversation.shortContext, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "发送失败", loading: false });
    }
  },
  requestHuman: async () => {
    const { conversationId } = get();
    if (!conversationId) return;
    set({ loading: true, error: undefined });
    try {
      await api.requestHumanHandoff(conversationId, "用户主动请求人工客服");
      const conversation = await api.getConversation(conversationId);
      set({ status: conversation.status, messages: conversation.shortContext, loading: false });
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
      set({ error: undefined });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "评价失败" });
    }
  }
}));
