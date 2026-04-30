import { Bot, ClipboardCheck, Headphones, LayoutDashboard, MonitorSmartphone, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth-store";
import { useChatStore } from "../store/chat-store";
import { AdminConsole } from "./AdminConsole";
import { AgentWorkspace } from "./AgentWorkspace";
import { ChatSurface } from "./ChatSurface";
import { LoginPage } from "./LoginPage";
import { MobileH5Page } from "./MobileH5Page";
import { OperationsRail } from "./OperationsRail";

const navItems = [
  { id: "web", path: "/", label: "Web Chat", icon: MonitorSmartphone },
  { id: "h5", path: "/h5", label: "移动 H5", icon: Smartphone },
  { id: "agent", path: "/agent", label: "客服工作台", icon: Headphones },
  { id: "admin", path: "/admin", label: "运营后台", icon: LayoutDashboard }
] as const;

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const refresh = useAuthStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
    const listener = () => setPath(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, [refresh]);

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">正在恢复登录态...</main>;
  }

  if (path === "/login") {
    return <LoginPage />;
  }

  if (!user) {
    window.history.replaceState(null, "", "/login");
    return <LoginPage />;
  }

  if (path === "/h5") {
    return <MobileH5Page />;
  }

  return <DesktopShell path={path} />;
}

function DesktopShell({ path }: { path: string }) {
  const activeView = useChatStore((state) => state.activeView);
  const setActiveView = useChatStore((state) => state.setActiveView);

  useEffect(() => {
    const next = path === "/agent" ? "agent" : path === "/admin" ? "admin" : "web";
    setActiveView(next);
  }, [path, setActiveView]);

  const navigate = (item: (typeof navItems)[number]) => {
    setActiveView(item.id);
    window.history.pushState(null, "", item.path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-foreground">政企智能客服平台</h1>
              <p className="text-sm text-slate-600">可信问答、人工兜底、合规审计、受控办理</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill icon={ShieldCheck} label="知识可追溯" />
            <StatusPill icon={ClipboardCheck} label="审计留痕" />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <nav className="rounded-md border border-border bg-white p-2 shadow-panel">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => navigate(item)}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition ${
                  isActive ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {activeView === "web" && <ChatSurface mode="web" />}
          {activeView === "agent" && <AgentWorkspace />}
          {activeView === "admin" && <AdminConsole />}
        </div>

        <OperationsRail />
      </section>
    </main>
  );
}

function StatusPill({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <Icon size={16} />
      {label}
    </span>
  );
}
