import { create } from "zustand";
import type { AuthUser } from "@ai-service/shared";
import * as api from "../api/client";

interface AuthState {
  user?: AuthUser;
  loading: boolean;
  error?: string;
  login: (username: string, password: string) => Promise<AuthUser>;
  refresh: () => Promise<AuthUser | undefined>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  loading: true,
  login: async (username, password) => {
    set({ loading: true, error: undefined });
    try {
      const result = await api.login({ username, password });
      set({ user: result.user, loading: false });
      return result.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      set({ error: message, loading: false });
      throw error;
    }
  },
  refresh: async () => {
    set({ loading: true, error: undefined });
    try {
      const result = await api.refreshSession();
      set({ user: result.user, loading: false });
      return result.user;
    } catch {
      set({ user: undefined, loading: false });
      return undefined;
    }
  },
  logout: async () => {
    await api.logout();
    set({ user: undefined, loading: false });
  }
}));
