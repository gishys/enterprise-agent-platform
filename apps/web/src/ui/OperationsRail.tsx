import { AlertTriangle, BarChart3, ShieldCheck } from "lucide-react";
import { highRiskTriggers, responseGuardrails, sensitivityRules } from "@ai-service/shared";

export function OperationsRail() {
  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <BarChart3 size={18} className="text-primary" />
          实时指标
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="命中率" value="86%" tone="text-emerald-700" />
          <Metric label="拒答率" value="7%" tone="text-amber-700" />
          <Metric label="转人工" value="14%" tone="text-primary" />
          <Metric label="评测通过" value="91%" tone="text-emerald-700" />
        </div>
      </section>

      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <ShieldCheck size={18} className="text-accent" />
          安全护栏
        </h2>
        <div className="space-y-2">
          {responseGuardrails.slice(0, 4).map((item) => (
            <div key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <AlertTriangle size={18} className="text-warning" />
          高风险触发词
        </h2>
        <div className="flex flex-wrap gap-2">
          {highRiskTriggers.map((item) => (
            <span key={item} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 text-base font-semibold">敏感级别</h2>
        {Object.entries(sensitivityRules).map(([level, rules]) => (
          <div key={level} className="mb-3">
            <div className="text-sm font-semibold text-primary">{level}</div>
            <p className="text-xs leading-5 text-slate-600">{rules.join("；")}</p>
          </div>
        ))}
      </section>
    </aside>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
