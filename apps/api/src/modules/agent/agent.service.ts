import { Injectable } from "@nestjs/common";
import type { AgentConversationItem, AuthUser } from "@ai-service/shared";

@Injectable()
export class AgentService {
  conversations(): AgentConversationItem[] {
    return [
      {
        conversationId: "demo-risk-001",
        customerName: "张先生",
        status: "transferred_to_human",
        priority: "risk",
        slaDueAt: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
        summary: "用户询问涉及审计删除和材料处理，机器人已拒答并转人工。",
        lastMessage: "是否可以删除审计记录并重新提交材料？"
      },
      {
        conversationId: "demo-normal-002",
        customerName: "李女士",
        status: "human_processing",
        priority: "normal",
        slaDueAt: new Date(Date.now() + 42 * 60 * 1000).toISOString(),
        summary: "用户需要确认材料清单和办理地区。",
        lastMessage: "我需要办理材料清单，地区是上海。"
      }
    ];
  }

  reply(conversationId: string, content: string, user: AuthUser) {
    return {
      conversationId,
      replyId: `reply-${Date.now()}`,
      content,
      sentBy: user.displayName,
      auditAction: "agent.reply",
      qualityTags: ["manual-reviewed", "source-required"],
      createdAt: new Date().toISOString()
    };
  }
}
