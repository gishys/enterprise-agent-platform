import { CheckCircle2, FileSearch, MessageSquareText, UserCheck } from "lucide-react";
import { useChatStore } from "../store/chat-store";

export function AgentWorkspace() {
  const messages = useChatStore((state) => state.messages);
  const userMessages = messages.filter((message) => message.role === "user");

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">客服工作台</h2>
          <p className="text-sm text-slate-600">人工接管时同步摘要、原始问题、知识命中和风险标签。</p>
        </div>
        <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">在线</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <AgentMetric icon={MessageSquareText} label="待接管会话" value="3" />
        <AgentMetric icon={FileSearch} label="待沉淀知识" value="12" />
        <AgentMetric icon={UserCheck} label="今日解决率" value="86%" />
      </div>
      <div className="mt-4 rounded-md border border-border">
        <div className="border-b border-border px-4 py-3 font-medium">当前会话摘要</div>
        <div className="space-y-3 p-4 text-sm text-slate-700">
          <p>用户正在咨询业务办理和系统操作相关问题，系统已记录知识来源和满意度评价。</p>
          <p>原始问题数：{userMessages.length}</p>
          <p>建议处理：若涉及政策解释、投诉举报或敏感数据查询，请按标准口径回复并保留人工处理记录。</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {["推荐回复：已为您核对常见办理指引，请补充事项名称和申请编号。", "质检提示：本会话包含人工兜底入口和审计标签。"].map((item) => (
          <div key={item} className="flex gap-3 rounded-md border border-border bg-slate-50 p-3 text-sm text-slate-700">
            <CheckCircle2 size={18} className="mt-1 text-accent" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentMetric({ icon: Icon, label, value }: { icon: typeof MessageSquareText; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <Icon size={18} className="mb-3 text-primary" />
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
