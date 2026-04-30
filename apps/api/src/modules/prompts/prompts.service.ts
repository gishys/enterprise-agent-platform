import { Injectable, NotFoundException } from "@nestjs/common";
import { promptTemplates } from "@ai-service/shared";

@Injectable()
export class PromptsService {
  publish(id: string, reviewer = "admin") {
    if (!(id in promptTemplates)) {
      throw new NotFoundException("未找到 Prompt 模板");
    }
    return {
      id,
      version: `v${Date.now()}`,
      status: "published",
      reviewer,
      auditAction: "prompt.publish",
      content: promptTemplates[id as keyof typeof promptTemplates],
      publishedAt: new Date().toISOString()
    };
  }
}
