# v0.18.63 Kernel Contributions Activity Preview Governance

## 迭代完成说明

本次完成 kernel `contributions/` 结构角色的方案沉淀、目录治理接入，并落地 `session-activity-preview` 会话活动预览能力。

已新增设计文档：

- `docs/plans/2026-05-15-kernel-contributions-and-session-activity-preview-design.md`

已沉淀规则：

- `contributions/` 是 kernel / runtime 级 package 的内部旁路能力组织角色，不是普通 feature、shared 或 plugin。
- 每个 contribution 使用 `contributions/<name>/index.ts` 作为唯一公开入口，contribution class 直接放在该入口。
- contribution 内部角色文件进入 `utils/`、`types/` 等角色子目录，不在 root 平铺。
- contribution 内部 utils/types 默认不通过 `index.ts` 重新导出，避免旁路能力变成新的公共依赖面。

已同步可执行治理：

- module-structure 脚本识别 `contributions/` 为结构骨架名。
- protocol 检查支持 `contributions/<name>/index.ts` 边界、内部角色目录、flat role 限制与 deep import 拦截。
- `packages/nextclaw-kernel` contract 显式允许 `src/contributions/`。

已落地实现：

- `NextclawKernel` 直接持有 contribution 数组，并在 `start()` / `dispose()` 中调用生命周期。
- `SessionActivityPreviewContribution` 监听 `eventKeys.ncpEvent`，从 NCP run / message / tool 事件投影 `metadata.last_activity_preview`。
- metadata 写入统一通过 `kernel.ncpSessionApi.updateSession(...)`，由既有 session summary upsert 链路通知前端。
- 前端 `adaptNcpSessionSummary` 读取 `last_activity_preview`，会话列表第二行优先展示 activity preview，缺失时回退原 message count。

## 测试/验证/验收方式

已运行：

```bash
node scripts/governance/module-structure/lint-new-code-module-structure.test.mjs
pnpm -C packages/nextclaw-kernel test -- src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.test.ts
pnpm -C packages/nextclaw-ui test -- src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/utils/chat-session-display.utils.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-ui tsc
pnpm lint:new-code:module-structure
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
node scripts/governance/module-structure/lint-new-code-module-structure.test.mjs
pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/contributions/session-activity-preview/index.ts src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.ts src/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.test.ts src/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.test.ts src/types/kernel-contribution.types.ts
pnpm -C packages/nextclaw-ui exec eslint src/features/chat/utils/ncp-session-adapter.utils.ts src/features/chat/utils/chat-session-display.utils.ts src/features/chat/components/chat-sidebar-session-item.tsx src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/utils/chat-session-display.utils.test.ts
```

结果：

- 61 个 module-structure 测试全部通过。
- kernel activity preview 定向测试 5 个通过。
- UI session adapter / display 定向测试 16 个通过。
- kernel / UI TypeScript 编译通过。
- 本次改动相关文件的定向 ESLint 通过。
- `pnpm lint:new-code:module-structure` 通过。
- `pnpm lint:new-code:governance` 通过。
- `pnpm check:governance-backlog-ratchet` 通过。
- maintainability guard 通过，无 error；剩余 warning 是既有目录/文件预算提示或 near-budget 提醒。

已尝试：

```bash
pnpm -C packages/nextclaw-ui lint
```

结果：被当前工作区既有 unrelated lint 问题阻塞，主要包括 `TimelineCheckpointPlacement` unused import、若干测试文件 `import()` type annotation、React refs 规则等；本次改动相关文件已用定向 ESLint 覆盖并通过。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

会话列表第二行预览已按本次设计落到：

- `packages/nextclaw-kernel/src/contributions/session-activity-preview/index.ts`
- contribution 内部 `utils/` / `types/` 等角色目录
- kernel contribution 数组生命周期
- `metadata.last_activity_preview` session summary 展示链路

目录治理允许上述结构，同时阻止 contribution root 下平铺实现文件或外部 deep import 内部工具。

## 可维护性总结汇总

本次尽最大努力把新结构角色接入既有治理体系，而不是只写普通文档或在后续实现时绕过 lint。

可维护性边界：

- 没有新增 manager / host / context 这类空心包装。
- `contributions/` 没有被开放为所有 package 的默认业务目录，只在 kernel contract 显式放开。
- contribution root 的公开面被压缩到 `index.ts` class，内部实现不会自然扩散成公共 API。
- 脚本测试覆盖了入口边界、root 平铺阻断、缺失 index、flat role 嵌套阻断和 deep import 阻断。

本次实现遵守 contribution 边界：kernel 只知道 contribution 生命周期数组，activity preview 的事件监听、metadata 合并与写回都收敛在 contribution 内部；前端只消费 summary metadata，不反向理解 NCP event 细节。

## NPM 包发布记录

不涉及 NPM 包发布。
