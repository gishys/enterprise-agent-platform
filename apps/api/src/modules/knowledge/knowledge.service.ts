import { Injectable, NotFoundException } from "@nestjs/common";
import type { KnowledgeItem, KnowledgeUploadJob } from "@ai-service/shared";

const knowledgeItems: KnowledgeItem[] = [
  {
    id: "kb-001",
    type: "process",
    title: "业务办理进度查询流程",
    owner: "运营服务部",
    status: "published",
    effectiveFrom: "2026-01-01",
    sensitivity: "internal",
    version: 3,
    sourceFile: "service-progress-guide.pdf",
    chunkCount: 42,
    indexStatus: "indexed",
    updatedAt: "2026-04-30T09:00:00.000Z"
  },
  {
    id: "kb-002",
    type: "standard-answer",
    title: "材料清单标准答案",
    owner: "业务管理部",
    status: "reviewing",
    effectiveFrom: "2026-02-01",
    sensitivity: "public",
    version: 2,
    sourceFile: "material-checklist.docx",
    chunkCount: 28,
    indexStatus: "indexed",
    updatedAt: "2026-04-29T11:30:00.000Z"
  }
];

const jobs = new Map<string, KnowledgeUploadJob>();

@Injectable()
export class KnowledgeService {
  list() {
    return knowledgeItems;
  }

  createUploadJob(fileName = "uploaded-document.pdf") {
    const job: KnowledgeUploadJob = {
      id: `job-${Date.now()}`,
      fileName,
      status: "indexed",
      createdAt: new Date().toISOString(),
      steps: [
        { name: "上传", status: "done" },
        { name: "解析", status: "done" },
        { name: "清洗", status: "done" },
        { name: "切片", status: "done" },
        { name: "向量化", status: "done" },
        { name: "关键词索引", status: "done" },
        { name: "待审核发布", status: "running" }
      ]
    };
    jobs.set(job.id, job);
    return job;
  }

  getJob(id: string) {
    const job = jobs.get(id);
    if (!job) {
      throw new NotFoundException("未找到知识库处理任务");
    }
    return job;
  }

  publish(id: string, reviewer = "admin") {
    const item = knowledgeItems.find((entry) => entry.id === id);
    if (!item) {
      throw new NotFoundException("未找到知识条目");
    }
    item.status = "published";
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    return {
      ...item,
      reviewer,
      auditAction: "knowledge.publish"
    };
  }
}
