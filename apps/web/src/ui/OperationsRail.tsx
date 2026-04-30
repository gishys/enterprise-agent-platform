import { highRiskTriggers, responseGuardrails, sensitivityRules } from "@ai-service/shared";

export function OperationsRail() {
  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 text-base font-semibold">合规护栏</h2>
        <div className="space-y-2">
          {responseGuardrails.map((item) => (
            <div key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 text-base font-semibold">高风险触发</h2>
        <div className="flex flex-wrap gap-2">
          {highRiskTriggers.map((item) => (
            <span key={item} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
              {item}
            </span>
          ))}
        </div>
      </section>
      <section className="rounded-md border border-border bg-white p-4 shadow-panel">
        <h2 className="mb-3 text-base font-semibold">数据分级</h2>
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
