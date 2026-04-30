import { promptTemplates, templateCatalog } from "@ai-service/shared";
import { BookOpenCheck, ClipboardList, FileText, Gauge, History, UploadCloud } from "lucide-react";
import { useState } from "react";

const metrics = [
  ["知识命中率", "86%", "text-emerald-700"],
  ["无答案率", "7%", "text-amber-700"],
  ["转人工率", "14%", "text-primary"],
  ["满意度", "4.6/5", "text-emerald-700"],
  ["平均响应", "920ms", "text-slate-800"],
  ["评测通过", "91%", "text-emerald-700"]
];

const tabs = [
  { id: "knowledge", label: "知识库", icon: BookOpenCheck },
  { id: "prompts", label: "Prompt", icon: FileText },
  { id: "templates", label: "模板", icon: ClipboardList },
  { id: "evaluations", label: "评测", icon: Gauge },
  { id: "audit", label: "审计", icon: History }
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState<TabId>("knowledge");

  return (
    <section className="rounded-md border border-border bg-white shadow-panel">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">运营后台</h2>
        <p className="text-sm text-slate-600">管理知识、Prompt、模板、自动评测和审计事件。</p>
      </div>

      <div className="grid gap-3 border-b border-border p-4 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value, tone]) => (
          <div key={label} className="rounded-md border border-border p-3">
            <div className={`text-xl font-semibold ${tone}`}>{value}</div>
            <div className="text-xs text-slate-600">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm ${active ? "bg-primary text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {activeTab === "knowledge" && <KnowledgePanel />}
        {activeTab === "prompts" && <PromptPanel />}
        {activeTab === "templates" && <TemplatePanel />}
        {activeTab === "evaluations" && <EvaluationPanel />}
        {activeTab === "audit" && <AuditPanel />}
      </div>
    </section>
  );
}

function KnowledgePanel() {
  const rows = [
    ["业务办理进度查询流程", "运营服务部", "published", "internal", "v3", "42", "indexed"],
    ["材料清单标准答案", "业务管理部", "reviewing", "public", "v2", "28", "indexed"],
    ["投诉升级处理规范", "客服质检组", "draft", "sensitive", "v1", "0", "queued"]
  ];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">知识库流程</h3>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-white">
          <UploadCloud size={16} />
          上传文档
        </button>
      </div>
      <DataTable
        headers={["标题", "负责人", "状态", "敏感级别", "版本", "切片", "索引"]}
        rows={rows}
      />
    </div>
  );
}

function PromptPanel() {
  const rows = Object.entries(promptTemplates).map(([key, value], index) => [
    key,
    index < 3 ? "published" : "draft",
    `v${index + 1}`,
    value.slice(0, 38),
    index < 3 ? "通过" : "待评测"
  ]);
  return <DataTable headers={["模板", "状态", "版本", "摘要", "评测"]} rows={rows} />;
}

function TemplatePanel() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {templateCatalog.map((group) => (
        <section key={group.group} className="rounded-md border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold text-primary">{group.group}</h3>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <span key={item} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EvaluationPanel() {
  return (
    <DataTable
      headers={["评测集", "状态", "得分", "样本量", "时间"]}
      rows={[
        ["高风险拒答与转人工", "passed", "96%", "120", "2026-04-30 08:00"],
        ["RAG 命中率与忠实度", "warning", "84%", "200", "2026-04-30 08:30"],
        ["满意度关联分析", "passed", "91%", "86", "2026-04-29 18:00"]
      ]}
    />
  );
}

function AuditPanel() {
  return (
    <DataTable
      headers={["动作", "资源", "风险", "操作者", "时间"]}
      rows={[
        ["knowledge.publish", "kb-001", "low", "admin", "2026-04-30 09:15"],
        ["conversation.handoff", "demo-risk-001", "high", "agent", "2026-04-30 09:28"],
        ["prompt.publish", "business-qa", "low", "admin", "2026-04-30 09:40"]
      ]}
    />
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap border-b border-border px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="hover:bg-slate-50">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="whitespace-nowrap border-b border-border px-3 py-2 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
