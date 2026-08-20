# 产品活跃统计与隐私分流

## 迭代完成说明

- 新增默认关闭的产品活跃统计。核心活跃定义为人类直接或渠道发起的 Agent 意图，不使用启动、页面浏览或心跳充当 DAU。
- 未登录安装在用户明确开启后生成随机 UUID；平台只保存服务端 HMAC 摘要。登录安装按账号归并，同一账号的多个安装只计一个主体。
- 外部用户、团队自用、QA、运行环境和发布通道分别建模。管理员账号强制归为 `internal`，默认看板固定查看生产稳定版外部用户。
- D1 只保存 180 天日布尔聚合，不保存消息、提示词、回复、工具参数、会话/项目/文件标识、URL、IP、User-Agent、硬件指纹或诊断日志。
- 用户端新增“隐私与统计”设置页；平台管理首页新增 DAU、WAU、MAU、成功活跃、匿名/已识别拆分与 30 日趋势。
- 完整设计见 `docs/designs/2026-08-20-product-activity-analytics.design.md`。

## 测试/验证/验收方式

- 8 个受影响 TypeScript 包完成匹配范围 `tsc`。
- Kernel、Core、Service、Server、UI 与 Worker 定向测试通过，覆盖人类/渠道/cron/child 判定、成功与失败 run、默认关闭、匿名 UUID、固定字段、认证、失败不阻塞、幂等聚合、登录归并、内部/QA 排除和管理员分流。
- 定向 ESLint 与 `pnpm lint:new-code:governance` 通过。
- 本地 D1 `0015_product-activity-analytics.sql` 迁移成功，两个新表存在。
- Platform Admin 生产构建与本地、线上浏览器 smoke 均通过。
- diff-only maintainability guard 二次检查为 0 errors；自动告警触发主观复核，结论为“无可维护性发现”。

## 发布/部署方式

- 2026-08-20 使用本机 Wrangler OAuth 登录态人工部署，不属于无人值守自动部署。
- 远端 D1 已应用 `0015_product-activity-analytics.sql`，迁移队列为空。
- Worker `nextclaw-provider-gateway-api` 已部署，版本 ID：`dceae4db-731a-40f4-8b40-ed05101d3685`。
- Worker 线上验证：health `200`、未授权管理接口 `401`、内部验收事件 `202`；D1 只读核验得到一个 internal 安装与一个 intent 日聚合，不进入 external 指标。
- Platform Admin Pages 已部署至 `https://adca4d6b.nextclaw-platform-admin.pages.dev`，生产域 `https://platform-admin.nextclaw.io` 返回 `200` 且浏览器 smoke 通过。
- 本批次由用户明确授权提交到本地 `master`；未 push，未发布 NPM/Desktop/runtime channel。

## 用户/产品视角的验收步骤

1. 在后续获得授权的客户端版本中进入“隐私与统计”，确认默认关闭；开启后可选择“外部用户”“团队 / 自用”或“QA 测试”。
2. 团队成员选择 internal、测试设备选择 QA，分别运行一次 Agent 请求；确认主流程不因统计接口不可用而失败。
3. 管理员登录 `https://platform-admin.nextclaw.io`，确认首页产品活跃区默认显示 production/stable/external，并可显式切换 internal 与 QA。
4. 核对 DAU/WAU/MAU、周成功活跃、匿名安装、已识别用户和识别率；不要把匿名安装解释为精确人数。

## 可维护性总结汇总

- 活动语义归 Kernel `SessionRun` 生命周期，匿名身份与传输归 Service，HMAC/归并/聚合归 Worker，展示归 Platform Admin；没有并行统计实现或第三方 SDK。
- 产品统计失败采用单一的显式 best-effort 合同：默认关闭、无重试队列、不影响 Agent 主流程，不用隐藏 fallback 掩盖部署错误。
- 产品配置 API 类型复用 Core 配置 schema；用户公开视图从超大 platform repository 抽到独立 utils，原 repository 净减少 14 行。
- 新文件和目录通过 planned-path preflight 与新代码治理；自动 guard 首轮的 3 个结构 finding 已返工并在二次 Review 清零。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：未扩大跨页面业务编排，只增加产品统计配置的读取与持久化薄入口。
- 说明：该红区仍是历史配置聚合 owner；本次通过复用 Core schema，避免在 Server 复制默认值和枚举真相源。
- 下一步拆分缝：按既有热点合同，优先按 chat/session/provider 域拆分配置构建与默认值归一化；产品统计配置可随 config feature 的域拆分迁出。

## NPM 包发布记录

- 本次不涉及 NPM 包发布。
- 已创建 `.changeset/product-activity-privacy.md`，`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/service`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 均为 patch，状态为待后续授权统一发布。
- 客户端尚未进入用户安装；只有后续明确授权的 NPM/Desktop/runtime 发布完成后，用户端采集和隐私设置才会实际可用。
