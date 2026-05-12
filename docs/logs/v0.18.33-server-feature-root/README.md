# Server Feature Root

## 迭代完成说明

本轮将 `@nextclaw/server` 从历史 `src/ui` 结构一次性迁移到 `app-l2`：

- `src/app` 承载 server/router 装配、app controller、app 级类型与入口测试。
- `src/features` 承载 agents、auth、config、cron、sessions、attachments、marketplace、remote-access、runtime-control、runtime-update、server-path 等 server 能力域。
- `src/shared` 承载跨 feature 复用的响应工具、事件工具与公共 API 类型。
- 删除 `src/ui` legacy island、`src/ui/module-structure.config.json` 和无意义 marketplace barrel。
- 将 `packages/nextclaw-server/module-structure.config.json` 升级为 `app-l2`，并更新 server 结构设计文档。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-server build`：通过。
- `pnpm -C packages/nextclaw-server exec vitest run`：22 个测试文件、84 个用例通过。
- `pnpm lint:new-code:governance -- --files packages/nextclaw-server/src packages/nextclaw-server/tsconfig.json packages/nextclaw-server/vitest.config.ts packages/nextclaw-server/module-structure.config.json docs/plans/2026-05-06-nextclaw-server-feature-organization-design.md docs/logs/v0.18.33-server-feature-root/README.md scripts/governance/maintainability-hotspots.mjs scripts/governance/file-directory-basename-collision-shared.mjs`：通过。
- `pnpm exec eslint packages/nextclaw-server/src/index.ts packages/nextclaw-server/src/app packages/nextclaw-server/src/features packages/nextclaw-server/src/shared packages/nextclaw-server/vitest.config.ts scripts/governance/maintainability-hotspots.mjs scripts/governance/file-directory-basename-collision-shared.mjs`：0 error，保留 7 个既有/迁移后热点 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：在临时暂存本轮 rename 范围后通过，0 error，保留 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check`：通过。
- `pnpm -C packages/nextclaw-server tsc`：被当前工作区 `packages/nextclaw-kernel` 的 `@kernel/features/*` alias 解析错误和隐式 any 诊断阻塞；未出现 server 迁移路径自身的 build 阻塞。

## 发布/部署方式

不涉及发布或部署。本轮是源码目录结构治理；后续如随功能批次发布，应按统一 NPM release 流程带出 `@nextclaw/server`。

## 用户/产品视角的验收步骤

用户可观察目标不是新增 API，而是降低 server 作为统一入口与 Client SDK 后端合同的维护成本：

1. 后续新增 server 能力时，不再落入 `src/ui`。
2. 维护者可从 `src/features/<feature>` 直接定位能力 owner。
3. `@nextclaw/server` 包根出口保持原有公共 API 语义，build 可生成 `dist/index.js` 与 `dist/index.d.ts`。

## 可维护性总结汇总

- 使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾复核。
- 代码增减报告：新增 565 行，删除 579 行，净增 -14 行。
- 非测试代码增减报告：新增 561 行，删除 575 行，净增 -14 行。
- 正向减债动作：删除与职责收敛。删除 `src/ui` legacy contract、旧 README、marketplace 中转 barrel 和旧 `src/ui/module-structure.config.json`；将 server 按 app / feature / shared 重新落位，并补齐 feature 唯一边界与 Vitest alias 配置。
- 仍保留的债务：`features/config/stores/server-config.store.ts` 和 `features/config/utils/provider-auth.utils.ts` 仍是大文件热点；本轮只改变 owner 落点，不在同一轮拆业务逻辑，避免结构迁移与行为重写叠加。
- 目录结构治理结果：`packages/nextclaw-server/src` 新代码治理与 module-structure diff 检查均通过。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：该文件从旧 `src/ui/config.ts` 迁移到 config feature 的 store 角色下，文件内容未继续增长；同时删除旧 `src/ui` legacy island，让后续 config 拆分有明确 feature root 和角色目录。
- 下一步拆分缝：按 provider、channel、search、runtime、secrets 拆分配置构建与写入逻辑，优先把 provider auth / search update / channel projection 从 store 热点里继续收敛出去。

## NPM 包发布记录

不涉及 NPM 包发布。
