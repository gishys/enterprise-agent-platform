import type { EntryConfiguration, PromptTemplateKind } from "./types.js";

export const defaultEntryConfiguration: EntryConfiguration = {
  botName: "H5 智能客服",
  botAvatar: "/bot-avatar.svg",
  welcomeMessage:
    "您好，我可以协助解答业务咨询、系统操作和办理指引问题。涉及政策解释、投诉举报或高风险事项时，我会为您转接人工客服。",
  quickQuestions: ["如何查询业务办理进度？", "我要一份材料清单", "当前政策适用条件是什么？", "转人工客服"],
  humanServiceAvailable: true,
  humanServiceHint: "人工客服在线，复杂事项可随时接管"
};

export const promptTemplates: Record<PromptTemplateKind, string> = {
  "base-service-role":
    "你是企业级智能客服助手。回答应准确、克制、可追溯，优先基于知识库和政策材料；遇到不确定、敏感或高风险事项时，应提示人工复核。",
  "business-qa":
    "围绕用户业务问题给出清晰答复。优先说明办理条件、所需材料、办理路径和下一步操作；缺少关键信息时先追问。",
  "system-operation":
    "你是系统操作向导。用分步方式说明入口、按钮、字段和注意事项，避免编造不存在的页面或功能。",
  "no-answer-refusal":
    "当知识库没有可靠依据时，不要臆测。说明暂未检索到确定答案，并建议补充信息或转人工客服。",
  "multi-turn-clarification":
    "当用户意图不完整时，先总结已知信息，再提出一个最关键的澄清问题，帮助用户继续办理。",
  "complaint-calming":
    "面对投诉或负面情绪时，先表达理解，再确认事实和诉求，避免辩解，并给出可执行的处理路径。",
  "human-handoff":
    "当触发人工接管时，生成简短会话摘要、用户诉求、已尝试答案和风险点，方便坐席继续处理。",
  "policy-standard-answer":
    "回答政策问题时，应引用适用范围、条件、时效和例外情况。不得扩大解释政策含义。",
  "sensitive-topic":
    "涉及隐私、投诉举报、资金、法律责任或高风险事项时，降低自动化决策强度，并建议人工复核。",
  "satisfaction-follow-up":
    "用户评价后，根据满意度进行简短跟进。满意时确认已解决；不满意时询问问题点并提供转人工选项。"
};

export const templateCatalog = [
  {
    group: "入口体验",
    items: ["Web Chat 入口", "H5 移动入口", "欢迎语", "快捷问题", "满意度反馈", "人工客服入口"]
  },
  {
    group: "会话能力",
    items: ["多轮会话", "消息发送", "SSE 流式响应", "人工接管", "来源引用", "反馈记录"]
  },
  {
    group: "Prompt 模板",
    items: Object.keys(promptTemplates)
  },
  {
    group: "知识库类型",
    items: ["FAQ", "业务规则", "操作手册", "政策文件", "产品说明", "事件公告", "流程规范", "标准答案"]
  },
  {
    group: "治理与运营",
    items: ["敏感词规则", "风险分级", "审计日志", "人工接管日志", "RAG 命中率", "未解决问题", "客服工作台"]
  }
];
