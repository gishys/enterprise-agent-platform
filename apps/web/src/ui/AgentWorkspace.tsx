import { AlertTriangle, CheckCircle2, Clock3, FileSearch, MessageSquareText, Send, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useChatStore } from "../store/chat-store";

const queue = [
  {
    id: "demo-risk-001",
    name: "张先生",
    priority: "risk",
    sla: "18 分钟",
    summary: "询问删除审计记录和重新提交材料，已触发拒答。",
    last: "是否可以删除审计记录并重新提交材料？"
  },
  {
    id: "demo-normal-002",
    name: "李女士",
    priority: "normal",
    sla: "42 分钟",
    summary: "需要确认材料清单、主体身份和办理地区。",
    last: "我需要办理材料清单，地区是上海。"
  }
];

const recommendedReplies = [
  "您好，涉及审计记录和材料真实性的问题需要人工复核。我会先核验您的业务编号和提交记录，再给出下一步处理建议。",
  "请补充业务类型、主体身份和办理地区。我会依据已发布知识库核对材料清单，并标注适用条件和来源。"
];

export function AgentWorkspace() {
  const messages = useChatStore((state) => state.messages);
  const userMessages = messages.filter((message) => message.role === "user");
  const [selectedId, setSelectedId] = useState(queue[0].id);
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0];
  const [reply, setReply] = useState(recommendedReplies[0]);
  const riskHints = useMemo(() => ["必须人工复核后回复", "不得承诺删除审计", "回复需保留处理依据"], []);

  return (
    <section className="rounded-md border border-border bg-white shadow-panel">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">人工客服工作台</h2>
          <p className="text-sm text-slate-600">接管摘要、推荐回复、质检提示和知识引用集中处理。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <AgentMetric icon={MessageSquareText} label="待接管" value="3" />
          <AgentMetric icon={Clock3} label="SLA 风险" value="1" />
          <AgentMetric icon={UserCheck} label="满意度" value="86%" />
        </div>
      </div>

      <div className="grid min-h-[620px] lg:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="border-b border-border p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 text-sm font-medium text-slate-700">接管队列</div>
          <div className="space-y-2">
            {queue.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setReply(item.priority === "risk" ? recommendedReplies[0] : recommendedReplies[1]);
                }}
                className={`w-full rounded-md border p-3 text-left text-sm ${selectedId === item.id ? "border-primary bg-slate-50" : "border-border hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${item.priority === "risk" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                    {item.priority === "risk" ? "风险" : "普通"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.summary}</p>
                <div className="mt-2 text-xs text-slate-500">SLA 剩余：{item.sla}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col p-4">
          <div className="rounded-md border border-border bg-slate-50 p-3">
            <div className="mb-1 text-sm font-medium">当前会话摘要</div>
            <p className="text-sm leading-6 text-slate-700">{selected.summary}</p>
            <p className="mt-2 text-xs text-slate-500">用户最近消息：{selected.last}</p>
          </div>

          <div className="mt-4 min-h-0 flex-1 rounded-md border border-border">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">会话上下文</div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p>当前页面会优先展示真实会话消息；没有选中线上会话时展示演示队列。</p>
              <p>已捕获用户消息数：{userMessages.length}</p>
              <p>所有人工回复均需编辑后发送，并进入审计和质检队列。</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium">推荐回复（发送前可编辑）</div>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              className="h-28 w-full resize-none rounded-md border border-border p-3 text-sm leading-6 outline-none focus:border-primary"
            />
            <button type="button" title="发送人工回复" className="mt-2 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-white">
              <Send size={16} />
              发送人工回复
            </button>
          </div>
        </main>

        <aside className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">质检提示</h3>
            <div className="space-y-2">
              {riskHints.map((item) => (
                <div key={item} className="flex gap-2 rounded-md bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">推荐知识</h3>
            {["业务办理进度查询流程", "材料清单标准答案"].map((item) => (
              <div key={item} className="mb-2 flex gap-2 rounded-md border border-border p-2 text-xs leading-5 text-slate-700">
                <FileSearch size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <CheckCircle2 size={16} className="mb-2" />
            回复会记录坐席、时间、来源、风险标签和质检结果。
          </div>
        </aside>
      </div>
    </section>
  );
}

function AgentMetric({ icon: Icon, label, value }: { icon: typeof MessageSquareText; label: string; value: string }) {
  return (
    <div className="min-w-[92px] rounded-md border border-border px-3 py-2">
      <Icon size={15} className="mb-1 text-primary" />
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
