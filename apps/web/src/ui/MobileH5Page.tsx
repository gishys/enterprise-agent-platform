import { LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { useAuthStore } from "../store/auth-store";
import { ChatSurface } from "./ChatSurface";

export function MobileH5Page() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-[#f4f7fb] text-foreground shadow-[0_20px_60px_rgb(15_23_42_/_0.18)]">
      <div className="flex min-h-[48px] items-center justify-between border-b border-slate-200/80 bg-white px-4 text-xs text-slate-600">
        <span className="inline-flex min-w-0 items-center gap-2">
          <ShieldCheck size={14} className="shrink-0 text-accent" />
          <span className="truncate">{user?.displayName ?? "访客"} · 已登录</span>
        </span>
        <div className="inline-flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 min-[360px]:inline-flex">
            <Sparkles size={12} />
            AI 在线
          </span>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => {
                window.history.pushState(null, "", "/login");
                window.dispatchEvent(new PopStateEvent("popstate"));
              });
            }}
            title="退出登录"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <ChatSurface mode="h5" />
      </div>
    </main>
  );
}
