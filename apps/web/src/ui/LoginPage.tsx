import { Bot, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuthStore } from "../store/auth-store";

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const error = useAuthStore((state) => state.error);
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("User@12345");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(username, password);
      window.history.pushState(null, "", user.role === "AGENT" ? "/agent" : user.role === "ADMIN" ? "/admin" : "/h5");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-sm rounded-md border border-border bg-white p-5 shadow-panel">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white">
            <Bot size={23} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">政企智能客服平台</h1>
            <p className="text-sm text-slate-600">请登录后继续使用</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-700">密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-border px-3 py-2 outline-none focus:border-primary" />
          </label>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-white disabled:opacity-60">
            <LogIn size={18} />
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          开发账号：user / User@12345，agent / Agent@12345，admin / Admin@12345
        </div>
      </section>
    </main>
  );
}
