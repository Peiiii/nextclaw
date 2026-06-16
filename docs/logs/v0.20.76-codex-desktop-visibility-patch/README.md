# v0.20.76 Codex Desktop Visibility Patch

## 迭代完成说明

本次实现了 Codex NARP runtime 的 Codex Desktop 会话可见性自动补丁。根因是 Codex Desktop sidebar 不直接展示所有 Codex thread，而是先按已知 workspace root、projectless thread 或显式 project assignment 分组；NextClaw fallback workspace `/Users/peiwang/.nextclaw/workspace` 之前没有注册进 Codex Desktop 的 workspace root 状态，因此对应 thread 虽然存在于 Codex sqlite/rollout 中，但可能不会在 Codex Desktop UI 中出现。

修复方式是在 Codex NARP runtime extension 边界新增 `CodexDesktopVisibilityPatchService`。wrapper 构建最终 runtime config 时，会把最终 `workingDirectory` 交给该 service；service 优先调用 Codex Desktop 自己的 `codex://new?path=...` 活入口，让 Desktop 主进程同步更新 globalState 与 UI 通知；只有 deep link 不可用或验证超时时才兜底写入 `electron-saved-workspace-roots`。kernel、service 和通用 NARP stdio client 没有感知 Codex Desktop 私有状态。

设计文档：[2026-06-16-codex-desktop-visibility-patch.design.md](../../designs/2026-06-16-codex-desktop-visibility-patch.design.md)。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk test`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-codex-sdk build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`
- 真实本地验收：调用 `open codex://new?path=%2FUsers%2Fpeiwang%2F.nextclaw%2Fworkspace` 后，确认 `/Users/peiwang/.codex/.codex-global-state.json` 中 `electron-saved-workspace-roots` 包含该 root；随后 Codex Desktop 改写 `active-workspace-roots` 时，该 root 仍保留在 saved roots 中。这证明正在运行的 Codex Desktop 主进程已接收该 workspace，而不是只被 NextClaw 外部写了一份 JSON 快照。

## 发布/部署方式

本次未执行发布或部署。改动影响 `@nextclaw/nextclaw-narp-runtime-codex-sdk`，后续若进入 beta/NPM 发布批次，需要随该 package 正常 build/prepack 发布。

## 用户/产品视角的验收步骤

1. 在 NextClaw 中创建或使用 Codex 会话。
2. 确认 Codex NARP runtime 使用的 `workingDirectory` 已通过 Codex Desktop deep link 注册为 workspace root。
3. 使用相同 cwd 创建的 Codex thread 应能按 workspace root 被归入 Codex Desktop 项目列表，不再成为 orphan thread。

说明：直接改 `.codex-global-state.json` 只能修改磁盘快照；如果 Codex Desktop 已经运行，它可能用旧内存态再次写回并覆盖外部补丁。因此当前实现优先使用 Desktop 自己的 `codex://new?path=...` 入口，兜底磁盘补丁只用于 deep link 不可用的场景。

## 可维护性总结汇总

本次遵守了边界补丁原则：新增逻辑只在 Codex 专属 extension service 中出现，没有污染 kernel、service 或通用 NARP stdio client。新增抽象不是通用平台抽象，而是具体外部私有状态边界 owner；wrapper 只依赖一个窄接口，测试可注入 no-op patch，避免单测写真实用户目录。

维护性检查结果：`No maintainability findings`。治理检查、文件命名、角色边界、module-structure、package public imports 均通过。

## NPM 包发布记录

本次未发布 NPM 包。涉及 package：`@nextclaw/nextclaw-narp-runtime-codex-sdk`，状态为待后续统一发布批次处理。
