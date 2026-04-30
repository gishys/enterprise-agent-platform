import type { SensitivityLevel } from "./types.js";

export const sensitivityRules: Record<SensitivityLevel, string[]> = {
  public: ["可公开展示", "仍需保留知识来源"],
  internal: ["仅内部用户可见", "默认不出现在公开 H5"],
  sensitive: ["默认脱敏", "访问前校验角色和数据权限", "记录审计日志"],
  restricted: ["默认转人工或审批", "禁止直接由模型生成结论", "必须保留二次确认记录"]
};

export const highRiskTriggers = [
  "投诉举报",
  "行政审批结论",
  "执法处罚解释",
  "退款或支付",
  "删除或变更业务数据",
  "个人敏感信息查询",
  "涉密或内部文件"
];

export const responseGuardrails = [
  "无可信知识依据时拒答或转人工",
  "政策制度类回答必须绑定标准口径或来源",
  "敏感字段默认脱敏",
  "模型不得绕过权限系统",
  "高风险操作必须二次确认并审计"
];
