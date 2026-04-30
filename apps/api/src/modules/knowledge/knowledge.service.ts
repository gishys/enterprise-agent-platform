import { Injectable } from "@nestjs/common";

@Injectable()
export class KnowledgeService {
  list() {
    return [
      {
        id: "kb-001",
        type: "process",
        title: "政企服务事项办理指引",
        owner: "业务运营部",
        status: "published",
        effectiveFrom: "2026-01-01",
        sensitivity: "internal"
      },
      {
        id: "kb-002",
        type: "operation-manual",
        title: "系统登录与权限申请操作手册",
        owner: "系统运维部",
        status: "published",
        effectiveFrom: "2026-01-01",
        sensitivity: "internal"
      }
    ];
  }
}
