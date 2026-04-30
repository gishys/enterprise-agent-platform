import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  await seedUser("admin", "Admin@12345", "平台管理员", "ADMIN", "数字化管理部");
  await seedUser("agent", "Agent@12345", "人工客服", "AGENT", "客服中心");
  await seedUser("user", "User@12345", "办事用户", "USER", "示范单位");

  await prisma.knowledge.upsert({
    where: { id: "kb-001" },
    update: {},
    create: {
      id: "kb-001",
      type: "process",
      title: "政企服务事项办理指引",
      body: "常见业务咨询应优先给出办理条件、材料清单、办理路径和人工兜底方式。",
      owner: "业务运营部",
      status: "PUBLISHED",
      sensitivity: "INTERNAL",
      effectiveFrom: new Date("2026-01-01")
    }
  });
}

async function seedUser(username: string, password: string, displayName: string, role: "USER" | "AGENT" | "ADMIN" | "AUDITOR", department: string) {
  await prisma.user.upsert({
    where: { username },
    update: {
      displayName,
      role,
      department,
      status: "ACTIVE"
    },
    create: {
      username,
      passwordHash: await argon2.hash(password),
      displayName,
      role,
      department,
      status: "ACTIVE"
    }
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
