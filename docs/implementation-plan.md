# 政企智能客服平台实施说明

## 首期目标

首期实现 Web Chat 组件和移动端 H5 两个入口，支持业务咨询、系统操作指导、多轮会话、满意度评价、人工客服转接、知识引用和审计留痕。

不建设多渠道会话合并，不接入微信、飞书、钉钉、企微等统一会话聚合。

## 模块落点

| 模块 | 当前落点 | 说明 |
| --- | --- | --- |
| 客户端入口 | `apps/web/src/ui/ChatSurface.tsx` | Web Chat 与 H5 共用交互逻辑 |
| 会话管理 | `apps/api/src/modules/conversation` | 会话创建、消息、SSE、满意度、转人工 |
| 知识库 | `apps/api/src/modules/knowledge` | 知识条目与状态骨架 |
| RAG | `apps/api/src/modules/rag` | 混合检索接口骨架 |
| 人工客服 | `apps/web/src/ui/AgentWorkspace.tsx` | 接管摘要、推荐回复、质检提示 |
| 合规治理 | `apps/api/src/modules/governance` | 风险词、安全护栏、人工兜底策略 |
| 运营后台 | `apps/web/src/ui/AdminConsole.tsx` | 模板、Prompt、指标视图 |
| 共享契约 | `packages/shared` | 类型、模板、合规策略 |

## 推荐落地顺序

1. 接入 PostgreSQL 与 Prisma Repository，替换当前内存会话。
2. 接入真实用户认证，完成角色权限和数据权限校验。
3. 接入文档上传、解析、切片、pgvector 向量化和 OpenSearch 关键词索引。
4. 接入模型网关、Langfuse 私有化实例和 Prompt 版本管理。
5. 将高风险筛查、拒答、转人工和满意度数据纳入自动评测。
6. 接入查询类业务 API，再逐步开放辅助办理流程。

## API 草案

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 账号密码登录 |
| `POST` | `/api/auth/logout` | 注销并撤销刷新令牌 |
| `POST` | `/api/auth/refresh` | 通过 HttpOnly Cookie 刷新登录态 |
| `GET` | `/api/auth/me` | 查询当前用户 |
| `POST` | `/api/conversations` | 创建会话 |
| `GET` | `/api/conversations/:id` | 查询会话摘要 |
| `POST` | `/api/conversations/:id/messages` | 发送用户消息 |
| `GET` | `/api/conversations/:id/stream` | SSE 流式回复 |
| `POST` | `/api/conversations/:id/handoff` | 转人工 |
| `POST` | `/api/conversations/:id/satisfaction` | 满意度评价 |
| `GET` | `/api/knowledge` | 知识列表 |
| `POST` | `/api/rag/retrieve` | RAG 检索 |
| `GET` | `/api/governance/guardrails` | 合规护栏 |
| `POST` | `/api/governance/screen` | 内容安全筛查 |
| `GET` | `/api/operations/dashboard` | 运营指标 |
| `GET` | `/api/operations/templates` | 模板目录 |

## 合规边界

- 模型不能绕过业务权限系统。
- 政策、制度、审批、投诉类问题必须基于标准口径或转人工。
- 无可信知识依据时拒答，不编造。
- 敏感字段默认脱敏。
- 高风险操作必须二次确认并审计。
- 所有模型输入输出、知识命中、满意度和人工接管记录都应留痕。

## 认证与角色

- 首期使用账号密码登录，后续可替换为 OIDC、LDAP 或统一身份平台。
- access token 仅保存在前端内存中，refresh token 使用 HttpOnly Cookie。
- 角色包含普通用户、客服、管理员和审计员。
- 普通用户只能访问自己的会话；客服可访问转人工会话；管理员和审计员按权限查看后台与审计数据。

## 移动端 H5

- 独立入口为 `/h5`，不再嵌在桌面三栏页面中。
- 顶部展示当前用户和退出入口，中部为消息流，底部固定输入区适配安全区。
- 快捷问题、发送消息、满意度和转人工均通过真实 API 完成。

## 后续阶段

### 阶段二：运营后台与人工客服协同

完善知识审核流、未解决问题池、人工推荐回复、满意度统计、Prompt 版本和灰度发布。

### 阶段三：受控系统查询

建设工具注册中心，接入查询类 API，强制身份、角色和数据权限校验，结果脱敏并审计。

### 阶段四：流程引导与辅助办理

支持表单收集、材料清单、规则校验、申请草稿、工单创建、流程暂停恢复和异常转人工。

### 阶段五：受控自动办理与企业级治理

仅对低风险、高标准化事项开放有限自动提交，同时建设灰度、评测、成本、SLA、审计报表和降级策略。
