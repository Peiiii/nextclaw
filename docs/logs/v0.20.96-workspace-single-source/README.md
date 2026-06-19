# v0.20.96 Workspace Single Source

## 迭代完成说明

- 根因：默认 workspace 符号 `~/.nextclaw/workspace` 被历史 chat session 写入 `project_root`，session resolver 将其当作显式项目目录，Docker 内会错误展开到 `/root/.nextclaw/workspace`，从而让 shell spawn 报出误导性的 `spawn /bin/sh ENOENT`。
- 确认方式：Docker API 中旧 session 的 metadata 保留 `project_root: "~/.nextclaw/workspace"`，但真实 `workingDir` 应来自配置 workspace；Node 在不存在 cwd 时也会报同类 ENOENT。
- 修复方式：core resolver 将默认 workspace 符号和等于已解析 workspace 的 override 归一为无显式 project root；kernel session summary 在默认 workspace 场景清理 legacy project metadata；chat 发送链路不再把默认 workspace 写入 `projectRoot/project_root`；welcome project picker 不再把默认 workspace 补成最近项目。
- 方案文档：`docs/designs/2026-06-19-workspace-single-source-of-truth.design.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core test -- --run src/features/session/services/session-project-context.service.test.ts`
- `pnpm --filter @nextclaw/kernel test -- --run src/managers/__tests__/session.manager.test.ts`
- `pnpm --filter @nextclaw/ui test -- --run src/features/chat/features/session/hooks/__tests__/use-selected-session-context-window-indicator.test.tsx src/features/chat/features/welcome/utils/__tests__/chat-welcome-project-options.utils.test.ts src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/pages/__tests__/ncp-chat-page.test.ts`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/core lint`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...workspace-fix-paths`
- 未执行真实 Docker API 与 ExecTool 冒烟；本轮以 core/kernel/UI assembled tests、类型检查、lint、治理和 scoped maintainability 作为最小可证明验证。剩余功能验收缺口是在 Docker 实例旧 session 上执行 `pwd`，确认输出真实 `/data/workspace`。

## 发布/部署方式

本次未执行发布或部署。修复触达 `@nextclaw/core`、`@nextclaw/kernel` 与 `@nextclaw/ui` 源码，已添加 changeset，后续进入统一版本发布时纳入对应包。

## 用户/产品视角的验收步骤

- 在 Docker 实例打开 chat welcome 的 project picker，默认 workspace 不应作为“最近项目”展示 `~/.nextclaw/workspace`。
- 旧 session 即使 metadata 中还保留默认 workspace 符号，对外 summary 的 `workingDir` 也应是 Docker 内真实 `/data/workspace`。
- 在该 session 中执行 shell `pwd` 应输出 `/data/workspace`，不再因 `/root/.nextclaw/workspace` 不存在而报 `spawn /bin/sh ENOENT`。

## 可维护性总结汇总

- 本次 workspace 修复路径的 scoped maintainability 通过，非测试代码净变化为 -2。
- owner 收敛到三处：core 负责 project/workspace 语义解析，kernel 负责 session summary 边界清理，UI 只负责展示和提交显式 project override。
- 未新增 workspace manager、server config 字段或前端路径解析规则，避免把默认 workspace 逻辑散到多处。
- 全工作区 maintainability guard 受到并发输入编辑器与 landing WIP 影响，当前完整工作区非测试净增 +64；本迭代只认定 workspace 修复路径的 scoped 结果。

## NPM 包发布记录

- 暂未发布 NPM 包。
- 受影响包：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui`。
- Changeset：`.changeset/quiet-workspaces-smile.md`。
- 状态：待后续统一发布。
