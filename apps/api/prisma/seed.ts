import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  await seedUser("admin", "Admin@12345", "Admin", "ADMIN", "Operations");
  await seedUser("agent", "Agent@12345", "Agent", "AGENT", "Service Desk");
  await seedUser("user", "User@12345", "User", "USER", "Public Services");

  await prisma.knowledge.upsert({
    where: { id: "kb-001" },
    update: {
      title: "业务办理进度查询流程",
      body: "用户可通过统一服务门户、移动 H5 或人工客服查询业务办理进度，查询前需完成身份校验。",
      owner: "运营服务部",
      status: "PUBLISHED",
      sensitivity: "INTERNAL",
      effectiveFrom: new Date("2026-01-01"),
      sourceFile: "service-progress-guide.pdf",
      parseStatus: "indexed",
      chunkCount: 42
    },
    create: {
      id: "kb-001",
      type: "process",
      title: "业务办理进度查询流程",
      body: "用户可通过统一服务门户、移动 H5 或人工客服查询业务办理进度，查询前需完成身份校验。",
      owner: "运营服务部",
      status: "PUBLISHED",
      sensitivity: "INTERNAL",
      effectiveFrom: new Date("2026-01-01"),
      sourceFile: "service-progress-guide.pdf",
      parseStatus: "indexed",
      chunkCount: 42
    }
  });

  await prisma.knowledge.upsert({
    where: { id: "kb-002" },
    update: {
      title: "材料清单标准答案",
      body: "材料清单应按业务类型、主体身份和属地政策组合生成；缺少条件时应先发起澄清。",
      owner: "业务管理部",
      status: "PUBLISHED",
      sensitivity: "PUBLIC",
      effectiveFrom: new Date("2026-02-01"),
      sourceFile: "material-checklist.docx",
      parseStatus: "indexed",
      chunkCount: 28
    },
    create: {
      id: "kb-002",
      type: "standard-answer",
      title: "材料清单标准答案",
      body: "材料清单应按业务类型、主体身份和属地政策组合生成；缺少条件时应先发起澄清。",
      owner: "业务管理部",
      status: "PUBLISHED",
      sensitivity: "PUBLIC",
      effectiveFrom: new Date("2026-02-01"),
      sourceFile: "material-checklist.docx",
      parseStatus: "indexed",
      chunkCount: 28
    }
  });
}

async function seedUser(
  username: string,
  password: string,
  displayName: string,
  role: "USER" | "AGENT" | "ADMIN" | "AUDITOR",
  department: string
) {
  await prisma.user.upsert({
    where: { username },
    update: {
      displayName,
      role,
      department,
      tenantId: "default",
      status: "ACTIVE"
    },
    create: {
      username,
      passwordHash: await argon2.hash(password),
      displayName,
      role,
      department,
      tenantId: "default",
      status: "ACTIVE"
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
