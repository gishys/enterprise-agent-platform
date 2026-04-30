import { Injectable, NotFoundException } from "@nestjs/common";
import type { KnowledgeItem, KnowledgeUploadJob } from "@ai-service/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { RagIndexService } from "../rag/rag-index.service.js";

const jobs = new Map<string, KnowledgeUploadJob>();

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndex: RagIndexService
  ) {}

  async list(): Promise<KnowledgeItem[]> {
    const items = await this.prisma.knowledge.findMany({ orderBy: { updatedAt: "desc" } });
    return items.map((item) => ({
      id: item.id,
      type: item.type as KnowledgeItem["type"],
      title: item.title,
      owner: item.owner,
      status: item.status.toLowerCase() as KnowledgeItem["status"],
      effectiveFrom: item.effectiveFrom?.toISOString() ?? item.createdAt.toISOString(),
      sensitivity: item.sensitivity.toLowerCase() as KnowledgeItem["sensitivity"],
      version: item.version,
      sourceFile: item.sourceFile ?? undefined,
      chunkCount: item.chunkCount,
      indexStatus: item.parseStatus as KnowledgeItem["indexStatus"],
      indexStage: item.parseStatus,
      updatedAt: item.updatedAt.toISOString()
    }));
  }

  createUploadJob(fileName = "uploaded-document.pdf") {
    const job: KnowledgeUploadJob = {
      id: `job-${Date.now()}`,
      fileName,
      status: "indexed",
      createdAt: new Date().toISOString(),
      steps: [
        { name: "upload", status: "done" },
        { name: "parse", status: "done" },
        { name: "clean", status: "done" },
        { name: "chunk", status: "done" },
        { name: "embedding", status: "running" },
        { name: "pgvector", status: "pending" },
        { name: "opensearch", status: "pending" },
        { name: "review", status: "pending" }
      ]
    };
    jobs.set(job.id, job);
    return job;
  }

  getJob(id: string) {
    const job = jobs.get(id);
    if (!job) {
      throw new NotFoundException("Knowledge processing job was not found.");
    }
    return job;
  }

  async publish(id: string, reviewer = "admin") {
    const item = await this.prisma.knowledge.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Knowledge item was not found.");
    }

    const published = await this.prisma.knowledge.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        approvedBy: reviewer,
        version: { increment: 1 },
        parseStatus: "chunking"
      }
    });
    const indexResult = await this.ragIndex.indexKnowledge(published);

    return {
      id: published.id,
      title: published.title,
      reviewer,
      auditAction: "knowledge.publish",
      indexStatus: indexResult.status,
      chunkCount: indexResult.chunkCount
    };
  }
}
