import { promptTemplates, templateCatalog } from "@ai-service/shared";

export function AdminConsole() {
  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">运营管理后台</h2>
        <p className="text-sm text-slate-600">统一管理知识、Prompt、标准口径、入口配置、会话质检和审计查询。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["知识命中率", "78%"],
          ["无答案率", "9%"],
          ["转人工率", "13%"],
          ["满意度", "4.6/5"]
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-sm text-slate-600">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-4 py-3 font-medium">模板体系</div>
          <div className="max-h-[360px] overflow-y-auto p-4">
            {templateCatalog.map((group) => (
              <div key={group.group} className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-primary">{group.group}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span key={item} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-4 py-3 font-medium">Prompt 版本</div>
          <div className="max-h-[360px] overflow-y-auto p-4">
            {Object.entries(promptTemplates).map(([key, value]) => (
              <div key={key} className="mb-3 rounded-md bg-slate-50 p-3">
                <div className="mb-1 text-sm font-semibold text-slate-800">{key}</div>
                <p className="text-xs leading-5 text-slate-600">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
