# 政企智能客服平台

面向政府机构、事业单位、国企及大型企业的智能客服平台骨架。首期入口聚焦 Web Chat 组件和移动端 H5，支持业务咨询、系统操作指导、多轮对话、满意度评价、人工客服转接和知识可追溯回答。

## 已实现内容

- Web Chat、移动端 H5、客服工作台、运营后台四个前端视图。
- NestJS 风格 API 服务骨架，覆盖会话、知识、RAG、人工客服、合规审计、标准口径、运营配置。
- Prisma 数据模型，覆盖会话、消息、知识、Prompt、审计日志、满意度、人工接管。
- 政企最佳实践模板库，包含入口、会话、Prompt、知识库、安全合规、工具调用、流程办理和评测模板。
- Docker Compose、Kubernetes 示例、GitLab CI、OpenTelemetry/Loki/Grafana 观测预留。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS + shadcn/ui 风格组件 + Zustand + SSE
- 后端：Node.js + NestJS + PostgreSQL + Redis + BullMQ + Prisma
- AI 与检索：模型接入层 + Embedding + PostgreSQL/pgvector + OpenSearch + Reranker + Langfuse
- 运维观测：Docker + Kubernetes + GitLab CI + Prometheus/Grafana + OpenTelemetry + Sentry + Loki

## 本地启动

```bash
npm install
npm run prisma:generate
npm run dev
```

API 服务：

```bash
npm run dev:api
```

## 数据库初始化

启动 PostgreSQL 后执行：

```bash
npm run prisma:migrate -w apps/api
npm run prisma:seed -w apps/api
```

开发种子账号：

- `user` / `User@12345`
- `agent` / `Agent@12345`
- `admin` / `Admin@12345`

## 真实入口

- 登录页：`/login`
- 移动端 H5：`/h5`
- 客服工作台：`/agent`
- 运营后台：`/admin`

认证采用短期 access token + HttpOnly refresh cookie。前端只在内存中保存 access token，刷新页面时通过 `/api/auth/refresh` 恢复登录态。

## 目录

```text
apps/web       Web Chat、H5、客服工作台、运营后台
apps/api       NestJS API 服务骨架
packages/shared 共享类型、模板、策略
infra          Docker、Kubernetes、CI 示例
docs           方案与模板说明
```

## 首期边界

- 包含 Web Chat 与移动端 H5。
- 不建设多渠道会话合并。
- 首期以可信问答、知识可追溯、满意度评价、人工兜底和审计留痕为核心。
- 系统查询、工具调用、流程引导和智能办理作为后续阶段逐步开放。
