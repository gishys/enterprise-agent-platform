import { defaultEntryConfiguration } from "@ai-service/shared";
import { Frown, Headphones, Meh, Send, Smile } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useChatStore } from "../store/chat-store";

export function ChatSurface({ mode }: { mode: "web" | "h5" }) {
  const messages = useChatStore((state) => state.messages);
  const status = useChatStore((state) => state.status);
  const loading = useChatStore((state) => state.loading);
  const error = useChatStore((state) => state.error);
  const startConversation = useChatStore((state) => state.startConversation);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const requestHuman = useChatStore((state) => state.requestHuman);
  const rateLastAnswer = useChatStore((state) => state.rateLastAnswer);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void startConversation(mode === "h5" ? "mobile-h5" : "web-chat");
  }, [mode, startConversation]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    void sendMessage(value);
    setDraft("");
  };

  return (
    <section className={`flex bg-white ${mode === "h5" ? "h-full flex-col" : "min-h-[720px] flex-col rounded-md border border-border shadow-panel"}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={defaultEntryConfiguration.botAvatar} alt="" className="h-10 w-10 rounded-md bg-slate-100" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{mode === "web" ? "Web Chat 组件" : "移动端 H5 智能客服"}</h2>
            <p className="truncate text-xs text-slate-600">{defaultEntryConfiguration.humanServiceHint}</p>
          </div>
        </div>
        <button
          type="button"
          title="转人工客服"
          onClick={() => void requestHuman()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-primary hover:bg-slate-100"
        >
          <Headphones size={18} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border bg-slate-50 px-4 py-3">
        {defaultEntryConfiguration.quickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void sendMessage(question)}
            className="shrink-0 rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-700 hover:border-primary hover:text-primary"
          >
            {question}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <article key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[86%] rounded-md px-3 py-2 text-sm leading-6 ${
                  isUser ? "bg-primary text-white" : "border border-border bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.sources?.map((source) => (
                  <div key={source.id} className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    来源：{source.title}，负责人：{source.owner}，匹配度：{Math.round(source.score * 100)}%
                  </div>
                ))}
                {message.auditTags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.auditTags.map((tag) => (
                      <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {!isUser && message.role === "assistant" ? (
                  <div className="mt-2 flex gap-1 border-t border-slate-100 pt-2">
                    <button type="button" title="满意" onClick={() => void rateLastAnswer("satisfied")} className="rounded-md p-1.5 hover:bg-slate-100">
                      <Smile size={15} />
                    </button>
                    <button type="button" title="一般" onClick={() => void rateLastAnswer("neutral")} className="rounded-md p-1.5 hover:bg-slate-100">
                      <Meh size={15} />
                    </button>
                    <button type="button" title="不满意" onClick={() => void rateLastAnswer("unsatisfied")} className="rounded-md p-1.5 hover:bg-slate-100">
                      <Frown size={15} />
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {loading ? <p className="text-center text-xs text-slate-500">正在处理...</p> : null}
        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="border-t border-border bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <div className="mb-2 text-xs text-slate-600">会话状态：{status}</div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="请输入业务咨询、系统操作或办理指引问题"
            className="min-w-0 flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="submit" title="发送" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}
