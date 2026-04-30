import { defaultEntryConfiguration } from "@ai-service/shared";
import type { RecommendationItem } from "@ai-service/shared";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Frown,
  Headphones,
  Meh,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useChatStore } from "../store/chat-store";

const statusLabels = {
  bot_processing: "AI 正在处理",
  waiting_for_user: "等待用户输入",
  transferred_to_human: "已转人工",
  human_processing: "人工处理中",
  closed: "会话已关闭"
} as const;

const statusTone = {
  bot_processing: "bg-sky-50 text-sky-700",
  waiting_for_user: "bg-emerald-50 text-emerald-700",
  transferred_to_human: "bg-amber-50 text-amber-800",
  human_processing: "bg-amber-50 text-amber-800",
  closed: "bg-slate-100 text-slate-600"
} as const;

export function ChatSurface({ mode }: { mode: "web" | "h5" }) {
  const messages = useChatStore((state) => state.messages);
  const status = useChatStore((state) => state.status);
  const loading = useChatStore((state) => state.loading);
  const error = useChatStore((state) => state.error);
  const recommendations = useChatStore((state) => state.recommendations);
  const startConversation = useChatStore((state) => state.startConversation);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const requestHuman = useChatStore((state) => state.requestHuman);
  const rateLastAnswer = useChatStore((state) => state.rateLastAnswer);
  const recordRecommendationEvent = useChatStore((state) => state.recordRecommendationEvent);
  const [draft, setDraft] = useState("");
  const maxLength = 500;

  useEffect(() => {
    void startConversation(mode === "h5" ? "mobile-h5" : "web-chat");
  }, [mode, startConversation]);

  useEffect(() => {
    recommendations.forEach((recommendation) => {
      void recordRecommendationEvent(recommendation.id, "impression", {
        rank: recommendation.rank,
        source: recommendation.source,
        intent: recommendation.intent,
        rankerVersion: recommendation.rankerVersion
      });
    });
  }, [recommendations, recordRecommendationEvent]);

  const isHandoff = status === "transferred_to_human" || status === "human_processing";
  const remaining = useMemo(() => maxLength - draft.length, [draft]);
  const surfaceClass =
    mode === "h5"
      ? "h-full flex-col bg-[#f4f7fb]"
      : "min-h-[720px] flex-col overflow-hidden rounded-md border border-border bg-[#f4f7fb] shadow-panel";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || loading || value.length > maxLength) return;
    void sendMessage(value);
    setDraft("");
  };

  const actOnRecommendation = async (recommendation: RecommendationItem) => {
    await recordRecommendationEvent(recommendation.id, "click", {
      rank: recommendation.rank,
      source: recommendation.source,
      intent: recommendation.intent
    });
    if (recommendation.type === "handoff") {
      await requestHuman();
      await recordRecommendationEvent(recommendation.id, "converted", { action: "handoff" });
      return;
    }
    await sendMessage(recommendation.label, recommendation.id);
  };

  return (
    <section className={`flex ${surfaceClass}`}>
      <div className="border-b border-slate-200 bg-white px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-primary text-white shadow-sm">
              <img src={defaultEntryConfiguration.botAvatar} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-950">
                  {mode === "web" ? "Web 智能客服" : "H5 智能客服"}
                </h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone[status]}`}>
                  {statusLabels[status]}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{defaultEntryConfiguration.humanServiceHint}</p>
            </div>
          </div>
          <button
            type="button"
            title="转人工客服"
            onClick={() => void requestHuman()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm hover:border-primary hover:bg-sky-50"
          >
            <Headphones size={18} />
          </button>
        </div>
      </div>

      {isHandoff ? (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          已为你接入人工客服，AI 会继续保留上下文，人工坐席可直接查看问题摘要和知识来源。
        </div>
      ) : null}

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isHuman = message.role === "human-agent";
          const AvatarIcon = isUser ? UserRound : isHuman ? Headphones : Bot;
          return (
            <article key={message.id} className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-primary text-white" : isHuman ? "bg-emerald-600 text-white" : "bg-white text-primary shadow-sm"
                }`}
              >
                <AvatarIcon size={15} />
              </div>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-3 text-sm leading-6 shadow-sm ${
                  isUser
                    ? "rounded-tr-md bg-primary text-white"
                    : isHuman
                      ? "rounded-tl-md border border-emerald-100 bg-emerald-50 text-slate-900"
                      : "rounded-tl-md border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.sources?.map((source) => (
                  <div key={`${source.id}-${source.chunkId ?? source.title}`} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate font-semibold text-slate-900">{source.title}</div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">
                        {Math.round(source.score * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>{source.owner}</span>
                      <span>v{source.version ?? 1}</span>
                      <span>{source.type}</span>
                      {source.sensitivity ? <span>{source.sensitivity}</span> : null}
                      {source.indexStage ? <span>{source.indexStage}</span> : null}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {new Date(source.effectiveFrom).toLocaleDateString()}
                      {source.effectiveTo ? ` - ${new Date(source.effectiveTo).toLocaleDateString()}` : ""}
                    </div>
                    <p className="mt-2 line-clamp-2 leading-5">{source.excerpt}</p>
                  </div>
                ))}
                {message.auditTags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {message.auditTags.map((tag) => (
                      <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {!isUser && message.role === "assistant" ? (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                      <ShieldCheck size={13} className="shrink-0" />
                      <span className="truncate">{message.promptVersion ?? "base-service-role@v1"}</span>
                    </div>
                    <div className="flex shrink-0 gap-0.5 text-slate-500">
                      <button type="button" title="满意" onClick={() => void rateLastAnswer("satisfied")} className="rounded-md p-1.5 hover:bg-slate-100 hover:text-emerald-700">
                        <Smile size={15} />
                      </button>
                      <button type="button" title="一般" onClick={() => void rateLastAnswer("neutral")} className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-800">
                        <Meh size={15} />
                      </button>
                      <button type="button" title="不满意" onClick={() => void rateLastAnswer("unsatisfied")} className="rounded-md p-1.5 hover:bg-slate-100 hover:text-danger">
                        <Frown size={15} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {recommendations.length ? (
          <RecommendationChips recommendations={recommendations} loading={loading} onSelect={(recommendation) => void actOnRecommendation(recommendation)} />
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
            <Sparkles size={14} className="text-primary" />
            正在检索知识库并生成回复...
          </div>
        ) : null}
        {error ? <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {loading ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
            <span className="truncate">会话状态：{statusLabels[status]}</span>
          </span>
          <span className={remaining < 0 ? "text-danger" : "text-slate-500"}>{draft.length}/{maxLength}</span>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={draft}
            maxLength={maxLength + 20}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="请输入业务问题，敏感事项会自动转人工复核"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-white"
          />
          <button
            type="submit"
            title="发送"
            disabled={loading || !draft.trim() || remaining < 0}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:bg-sky-900 disabled:opacity-60"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}

function RecommendationChips({
  recommendations,
  loading,
  onSelect
}: {
  recommendations: RecommendationItem[];
  loading: boolean;
  onSelect: (recommendation: RecommendationItem) => void;
}) {
  return (
    <div className="ml-9">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recommendations.map((recommendation) => {
          const isHandoff = recommendation.type === "handoff";
          return (
            <button
              key={recommendation.id}
              type="button"
              title={recommendation.label}
              onClick={() => onSelect(recommendation)}
              disabled={loading}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-sm transition disabled:opacity-60 ${
                isHandoff
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary"
              }`}
            >
              {isHandoff ? <Headphones size={14} /> : <Sparkles size={13} />}
              <span className="max-w-[180px] truncate">{recommendation.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
