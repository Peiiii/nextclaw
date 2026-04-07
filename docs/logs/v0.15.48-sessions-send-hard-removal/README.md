# v0.15.48 Sessions Send Hard Removal

## 迭代完成说明

- 按删除优先原则，彻底移除了 `sessions_send` 工具本体，不保留兼容别名、兜底路由或保守迁移层；对应实现、注册、NCP 暴露、插件保留字与 AI tool catalog 已全部收敛删除。
- 同步删除只为这条链路服务的 `session.agentToAgent.maxPingPongTurns` 配置面，包括 core schema、server/ui config patch、UI 表单、类型与 i18n 文案，避免产品界面继续暴露已经失效的控制项。
- 将 AI 提示与内置 skill 改为单一路径：跨会话/跨渠道投递统一使用 `message`，必要时先用 `sessions_list` 回收现有 route，不再教模型选择一个独立的“会话发送”原语。
- 删除 `SessionsSendTool` 单测并把仍然有效的 `SessionsListTool` 路由过滤测试迁移到新文件，避免测试层继续保留已删除能力的名字与行为。
- 同步清理当前产品面文档与设计说明，包括 [`docs/USAGE.md`](../../USAGE.md)、[`packages/nextclaw/resources/USAGE.md`](../../../packages/nextclaw/resources/USAGE.md)、[`docs/prd/current-feature-list.md`](../../prd/current-feature-list.md)、[`docs/feature-universe.md`](../../feature-universe.md)、`apps/docs` 的多 Agent 指南以及当前多 Agent 设计参考；包内 `ui-dist` 也已重建，不再携带旧 UI 文案。本次方案记录见 [`2026-04-08-sessions-send-removal-plan.md`](../../plans/2026-04-08-sessions-send-removal-plan.md)。

## 红区触达与减债记录

### packages/nextclaw-core/src/agent/loop.ts

- 本次是否减债：是，局部减债。
- 说明：直接删掉了 `sessions_send` 的注册、运行时上下文注入与 handoff depth plumbing，热点文件净减 41 行，没有再把已废弃抽象换壳保留。
- 下一步拆分缝：先拆 session lookup、tool loop orchestration、response finalization 三段。

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：是，局部减债。
- 说明：删除 `session.agentToAgent` 的专用 merge 分支后，`session` patch 回到单层 merge；虽然只减了 6 行，但至少没有继续在热点文件上叠专用分支。
- 下一步拆分缝：先按 chat/session/provider 三个域拆分配置构建与默认值归一化。

## 测试/验证/验收方式

- 文档同步：
  - `PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/scripts/sync-usage-resource.mjs`
- 包内 UI 产物同步：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - `PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/scripts/copy-ui-dist.mjs`
- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts src/agent/tests/loop.tool-catalog.test.ts src/agent/tools/sessions-list.test.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- 定向 ESLint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec eslint packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/agent/loop.ts packages/nextclaw-core/src/agent/tests/context.test.ts packages/nextclaw-core/src/agent/tools/sessions.ts packages/nextclaw-core/src/agent/tools/sessions-list.test.ts packages/nextclaw-core/src/agent/tools/tool-catalog.utils.ts packages/nextclaw-core/src/config/schema.help.ts packages/nextclaw-core/src/config/schema.labels.ts packages/nextclaw-core/src/config/schema.ts packages/nextclaw-server/src/ui/config.ts packages/nextclaw-server/src/ui/types.ts packages/nextclaw-ui/src/api/types.ts packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx packages/nextclaw-ui/src/lib/i18n.ts packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts packages/nextclaw/src/cli/commands/plugin/plugin-command-utils.ts`
  - 结果：无 error；仅剩仓库既有热点文件 warning，本次未新增新的 lint 问题。
- Maintainability guard：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：补齐 hotspot 留痕后通过；剩余 warning 为既有热点文件/目录预算问题，本次均未继续恶化。

## 发布/部署方式

- 不适用。本次为本地代码、提示词、配置 UI 与文档收敛删除，没有执行发版或部署。

## 用户/产品视角的验收步骤

1. 让当前 Agent 列出可用工具，确认工具列表里已不存在 `sessions_send`。
2. 打开 `Routing & Runtime` 页面，确认只保留 `agents.list`、`bindings`、`session.dmScope`，不再出现 `Max Ping-Pong Turns`。
3. 查看系统提示/内置 skill 的消息投递说明，确认跨会话投递已经改为“必要时先 `sessions_list` 找 route，再统一用 `message` 发送”。
4. 打开 [`docs/USAGE.md`](../../USAGE.md) 或运行时打包文档，确认多 Agent 说明里不再出现 `session.agentToAgent.maxPingPongTurns`。
5. 运行 `sessions_list` 的路由过滤测试，确认保留下来的会话发现能力仍然正常。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次选择的是直接删除抽象，而不是保留兼容层、fallback 或迁移胶水。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。先删工具，再删专属配置/UI/提示/测试，没有把旧能力换个名字继续保留。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。代码文件统计为新增 15 行、删除 488 行、净减 473 行；非测试代码统计为新增 5 行、删除 321 行、净减 316 行。测试文件总数持平（删除 `sessions-send.test.ts`，新增 `sessions-list.test.ts`），没有新增目录平铺。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。产品重新回到“`message` 是唯一投递原语，session 只是 route 发现来源”的边界，避免了平行的消息发送模型。
- 目录结构与文件组织是否满足当前项目治理要求：本次没有新增目录问题，但 `packages/nextclaw-core/src/agent/loop.ts`、`packages/nextclaw-server/src/ui/config.ts`、`packages/nextclaw-ui/src/components/config/RuntimeConfig.tsx` 等历史热点仍超预算；本次已在上方记录减债与下一步拆分缝，未单独展开更大范围拆分以免偏离主任务。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：15 行
    - 删除：488 行
    - 净增：-473 行
  - 非测试代码增减报告：
    - 新增：5 行
    - 删除：321 行
    - 净增：-316 行
  - no maintainability findings
  - 可维护性总结：这次属于典型的非功能减债改动，而且确实做到了“删掉能力而不是包一层兼容”。剩余债务主要是几个老热点文件本身仍然偏大，但本次删除已经把相关分支和表单面积收回去了，没有把复杂度换位置保留。
