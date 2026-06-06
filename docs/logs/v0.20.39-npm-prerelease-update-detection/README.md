# v0.20.39 NPM 预发布版本更新检测修复

## 迭代完成说明

本次修复 `nextclaw@0.21.5-beta.0` 检查 `0.21.5` stable runtime update 时被错误判断为 `up-to-date` 的问题。

根因是 `compareNpmRuntimeVersions` 原先按 `.` 和 `-` 拆数字，`beta` 会被转成 `0`，导致 `0.21.5` 与 `0.21.5-beta.0` 没有按 semver prerelease 规则区分。`NpmRuntimeUpdateService.checkForUpdate` 因此在比较 stable manifest `latestVersion: 0.21.5` 和当前 `0.21.5-beta.0` 时直接返回无更新，UI 左上角拿到 `up-to-date` 后按设计不显示下载或更新入口。

修复点收敛在 `packages/nextclaw-service/src/launcher/npm-runtime-bundle.service.ts` 的版本比较 owner：先比较 core 版本，忽略 build metadata，并按正式版高于 prerelease、`beta.1` 高于 `beta.0` 的规则比较。没有在 UI 或 CLI 命令层增加特殊分支。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service test -- src/launcher/npm-runtime-update.manager.test.ts`：通过，10 个测试通过；新增覆盖 `0.21.5-beta.0` 检查 stable `0.21.5` 返回 `update-available`。
- `pnpm --filter @nextclaw/service exec tsx -e ...`：本地版本矩阵通过，确认 `0.21.5 > 0.21.5-beta.0`、`0.21.5-beta.1 > 0.21.5-beta.0`、`0.21.5-beta.0 < 0.21.5`、`0.21.6-beta.0 > 0.21.5`、build metadata 不影响比较。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/service lint`：通过，无 error；保留 8 个既有 warning，触达文件 targeted lint 干净。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-service/src/launcher/npm-runtime-bundle.service.ts packages/nextclaw-service/src/launcher/npm-runtime-update.manager.test.ts`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

## 发布/部署方式

本次不涉及数据库 migration、远程后端部署或桌面 installer 发布。

需要后续 NPM patch 发布，已添加 `.changeset/fix-npm-runtime-prerelease-update.md`，影响 `nextclaw` 与 `@nextclaw/service`。

## 用户/产品视角的验收步骤

在包含本修复的 NPM 版本发布后，从 `nextclaw@0.21.5-beta.0` 或同 base 版本 beta launcher 检查 stable channel，应看到 stable `0.21.5` 被识别为可用更新，UI 左上角应出现下载/更新入口或对应下载状态。

本地源码层已用 manager checkOnly 路径验收：当前版本 `0.21.5-beta.0`、manifest latest `0.21.5` 时，快照状态为 `update-available`，`availableVersion` 为 `0.21.5`。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 口径完成复核。总计新增 50 行、删除 21 行、净增 29 行；非测试代码新增 13 行、删除 13 行、净增 0 行。

正向减债动作是简化：在同一版本判断 helper 区域删掉 `shouldPreferPackagedNpmRuntime` 对 `currentBundleVersion` 的重复解析，抵消 prerelease 比较所需的生产代码增长。实现没有新增依赖、fallback、UI 特判或平行更新路径。

## NPM 包发布记录

本次修复涉及 NPM 包发布，但当前任务只完成源码修复与验证，未执行发布。

- `nextclaw`：需要 patch 发布，让用户入口获得修复后的 service 依赖。
- `@nextclaw/service`：需要 patch 发布，包含 runtime update 版本比较修复。
