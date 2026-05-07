# v0.18.15 PWA Service Worker Cache Fix

## 迭代完成说明

修复 NextClaw UI 刷新后可能被 PWA service worker 恢复到旧首页壳的问题。

根因：`sw.js` 在安装阶段预缓存了 `/`，并且导航请求网络失败时会回退到 `caches.match(request)`。当本地服务重启、升级或短暂不可用时，刷新可能拿到旧版本首页壳；旧壳随后连接当前后端 API，造成截图中那种旧 UI、裸样式和 404 API 混用状态。

确认方式：截图中 unregister service worker 后刷新恢复，且网络面板显示请求由 `sw.js` 参与；源码中确认 `/` 被预缓存且导航失败会读取旧导航缓存。

修复方式：`sw.js` 不再预缓存 `/`，导航失败只返回 `offline.html`，并把缓存名升级到 `v2` 以清理旧缓存；同时 `install` 阶段调用 `skipWaiting()`，让修复后的 worker 更快接管。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/pwa/managers/pwa-service-worker-cache.manager.test.ts`：通过，锁定 SW 不缓存首页壳且导航失败不回退旧导航响应。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过，确认生产产物里的 `dist/sw.js` 带上新策略。
- `node scripts/governance/lint-new-code-file-role-boundaries.test.mjs`：通过。
- `pnpm lint:new-code:governance -- packages/nextclaw-ui/public/sw.js packages/nextclaw/ui-dist/sw.js packages/nextclaw-ui/src/features/pwa/managers/pwa-service-worker-cache.manager.test.ts scripts/governance/lint-new-code-file-role-boundaries.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过；仅保留 `scripts/governance` 既有目录预算警告。

真实 `nextclaw serve` 隔离冒烟被当前工作区另一组 openclaw compat 重命名/删除中的文件挡住，`tsx` 解析缺失的 `plugin-capability-registration.js` 时失败；未改动该并行工作。

## 发布/部署方式

本轮尚未发布。修复已同步到 `packages/nextclaw-ui/public/sw.js` 与打包用的 `packages/nextclaw/ui-dist/sw.js`，后续 NPM/runtime bundle 发布会携带该修复。

## 用户/产品视角的验收步骤

升级到包含该修复的版本后，打开 NextClaw UI 并刷新页面。即使服务重启窗口内刷新，也不应再加载旧版首页壳；如果后端暂时不可用，应进入离线页，而不是旧 UI 混连新后端。

## 可维护性总结汇总

本次是非功能 bugfix。生产 SW 逻辑减少了旧导航缓存分支，行为更单一：导航优先网络，失败只离线，不再恢复旧首页壳。

可维护性复核结论：通过。  
本次顺手减债：是。  
正向减债动作：简化。  
质量与可维护性提升证明：删除了导航失败时读取旧请求缓存的分支，并用测试锁住该合同。  
为何不是单纯压缩行数：行为合同变少，缓存 owner 仍在 service worker，没有把复杂度转移到 UI 层或下游 API。

代码增减报告：新增 41 行，删除 14 行，净增 27 行。  
非测试代码增减报告：新增 12 行，删除 14 行，净增 -2 行。

## NPM 包发布记录

不涉及 NPM 包发布。
