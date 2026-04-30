import type { EntryConfiguration, PromptTemplateKind } from "./types.js";

export const defaultEntryConfiguration: EntryConfiguration = {
  botName: "政企智能客服",
  botAvatar: "/bot-avatar.svg",
  welcomeMessage: "您好，我可以协助解答业务咨询、系统操作和办理指引问题。涉及政策解释、投诉举报或高风险事项时，我会为您转接人工客服。",
  quickQuestions: [
    "如何查询办理进度？",
    "系统登录失败怎么办？",
    "需要准备哪些申请材料？",
    "如何转人工客服？"
  ],
  humanServiceAvailable: true,
  humanServiceHint: "人工客服在线，可随时转接"
};

export const promptTemplates: Record<PromptTemplateKind, string> = {
  "base-service-role": "你是面向政府机构、事业单位、国企及大型企业场景的智能客服。回答必须严谨、克制、可追溯，不得越权承诺办理结果。",
  "business-qa": "基于检索到的知识回答业务咨询。必须优先引用知识来源；若缺少可信依据，应说明无法确认并建议转人工。",
  "system-operation": "以分步骤方式指导用户完成系统操作。不要要求用户提供密码、验证码等敏感信息。",
  "no-answer-refusal": "当知识库没有可信答案时，明确说明暂未查询到依据，不得编造，并提供人工转接选项。",
  "multi-turn-clarification": "当用户问题缺少必要条件时，最多追问两个关键问题，避免一次性索取过多信息。",
  "complaint-calming": "先表达理解，再收集必要事实，避免定责和承诺赔付，必要时转人工处理。",
  "human-handoff": "概括用户诉求、已提供的信息、已尝试的处理方式和建议人工关注点。",
  "policy-standard-answer": "政策、制度、审批、执法、投诉类问题必须依据标准口径回答，并保留引用来源。",
  "sensitive-topic": "涉及个人信息、涉密、舆情、投诉举报或高风险事项时，遵循最小披露原则并触发人工兜底。",
  "satisfaction-follow-up": "根据用户评价记录满意度；低满意度时询问是否转人工或补充问题。"
};

export const templateCatalog = [
  {
    group: "客服入口模板",
    items: ["Web Chat 嵌入模板", "移动端 H5 页面模板", "机器人头像模板", "欢迎语模板", "快捷问题模板", "多轮上下文展示模板", "满意度评价模板", "人工客服转接模板"]
  },
  {
    group: "会话模板",
    items: ["会话创建模板", "会话恢复模板", "会话关闭模板", "会话摘要模板", "历史对话模板", "超时处理模板", "人工接管状态模板"]
  },
  {
    group: "Prompt 模板",
    items: Object.keys(promptTemplates)
  },
  {
    group: "知识库模板",
    items: ["FAQ 模板", "业务规则模板", "系统操作手册模板", "政策制度模板", "产品说明模板", "故障处理模板", "流程说明模板", "版本变更模板", "标准口径答复模板"]
  },
  {
    group: "合规与安全模板",
    items: ["数据分类分级模板", "敏感字段脱敏模板", "审计日志模板", "权限策略模板", "高风险问题转人工模板", "高风险操作确认模板", "生成内容安全审核模板", "等保测评配合材料模板"]
  },
  {
    group: "工具调用模板",
    items: ["查询类工具模板", "创建类工具模板", "更新类工具模板", "审批类工具模板", "通知类工具模板", "高风险操作模板"]
  },
  {
    group: "流程办理模板",
    items: ["信息收集流程模板", "工单创建流程模板", "售后申请流程模板", "权限申请流程模板", "审批流转流程模板", "异常转人工流程模板"]
  },
  {
    group: "评测模板",
    items: ["标准问答测试集", "多轮对话测试集", "系统操作指导测试集", "无答案拒答测试集", "转人工测试集", "满意度评价测试集", "RAG 命中测试集", "Prompt Injection 测试集", "越权访问测试集", "敏感内容测试集", "工具调用测试集", "流程办理测试集"]
  }
];
