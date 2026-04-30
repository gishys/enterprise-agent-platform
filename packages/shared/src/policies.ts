import type { SensitivityLevel } from "./types.js";

export const sensitivityRules: Record<SensitivityLevel, string[]> = {
  public: ["可面向所有访客展示", "回答中可直接引用公开来源"],
  internal: ["仅对登录用户展示", "回答中保留来源和有效期"],
  sensitive: ["仅授权角色可见", "输出前必须做脱敏和风险复核"],
  restricted: ["默认不直接输出", "必须转人工或走审批流程"]
};

export const highRiskTriggers = [
  "绕过审核",
  "伪造材料",
  "泄露隐私",
  "删除审计",
  "规避监管",
  "投诉升级",
  "舆情",
  "违法",
  "密码",
  "身份证"
];

export const responseGuardrails = [
  "只基于已发布、在有效期内、用户有权限访问的知识回答",
  "没有可靠依据时拒绝编造，并给出澄清问题或转人工路径",
  "涉及敏感、限制级或高风险内容时自动标记并触发人工兜底",
  "所有答案保留来源引用、Prompt 版本、模型 trace 和审计标签",
  "业务办理类动作默认只提供说明，实际提交需二次确认和权限校验"
];

export function screenRisk(content: string | undefined) {
  const text = content?.trim() ?? "";
  const triggers = highRiskTriggers.filter((trigger) => text.includes(trigger));
  return {
    allowed: triggers.length === 0,
    requiresHumanHandoff: triggers.length > 0,
    triggers,
    decision: triggers.length > 0 ? ("handoff" as const) : ("continue" as const),
    riskLevel: triggers.length > 0 ? ("high" as const) : ("low" as const)
  };
}
