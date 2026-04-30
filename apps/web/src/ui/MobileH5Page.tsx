import { LogOut } from "lucide-react";
import { useAuthStore } from "../store/auth-store";
import { ChatSurface } from "./ChatSurface";

export function MobileH5Page() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <main className="mx-auto flex h-[100dvh] max-w-md flex-col bg-white">
      <div className="flex items-center justify-between border-b border-border bg-white px-4 py-2 text-xs text-slate-600">
        <span>{user?.displayName ?? "访客"}</span>
        <button
          type="button"
          onClick={() => {
            void logout().then(() => {
              window.history.pushState(null, "", "/login");
              window.dispatchEvent(new PopStateEvent("popstate"));
            });
          }}
          title="退出登录"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100"
        >
          <LogOut size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatSurface mode="h5" />
      </div>
    </main>
  );
}
