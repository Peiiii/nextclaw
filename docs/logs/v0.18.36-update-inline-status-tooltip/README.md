# v0.18.36 Update Inline Status Tooltip

## 迭代完成说明

- 根因：顶部品牌区把 runtime update 的 `blocked` 和 `failed` 都展示成可见的“更新异常”，且没有把 `errorMessage` / `blockReason` / `recoveryCommand` 暴露到 hover 提示里，导致用户看不到具体原因。
- 确认方式：检查 `UpdateStatus` 类型和 npm runtime update manager，`blocked` 是前置条件阻塞，`failed` 才是更新失败；CLI 链路也分别输出 `Update blocked` 与 `Update failed`。
- 修复方式：顶部只显示黄色感叹号；hover 使用原生 `title` 展示状态、具体原因和恢复命令。`blocked` 展示“更新被阻塞”，`failed` 展示“更新失败”，避免把阻塞态误报为失败。
- 后续结构治理：新增 `NextclawDistributionService` 作为 service runtime 层的固定发行事实 owner，由 `packages/nextclaw` 顶层入口基于自己的 `import.meta.url` 配置一次，统一提供版本、包根目录、应用入口、UI dist 和 runtime update 公钥路径；service/gateway/update host 直接读取该 owner，不再沿调用链层层透传发行参数。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/shared/components/common/brand-header.test.tsx`：通过，4 个测试覆盖下载进度、已下载更新、blocked 提示、failed 提示。
- `pnpm -C packages/nextclaw-ui exec eslint src/shared/components/common/brand-header.tsx src/shared/components/common/brand-header.test.tsx src/shared/lib/i18n/desktop-update-labels.utils.ts`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过，阻塞项均为本次触达文件之外的既有错误。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/shared/components/common/brand-header.tsx packages/nextclaw-ui/src/shared/components/common/brand-header.test.tsx packages/nextclaw-ui/src/shared/lib/i18n/desktop-update-labels.utils.ts`：通过。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw-service test -- src/shared/services/ui/tests/npm-runtime-update-host.service.test.ts src/shared/utils/cli.utils.ui-static-dir.test.ts`：通过。
- `pnpm -C packages/nextclaw-service build`：通过，用于刷新本地忽略的 `dist` 类型产物后验证消费者包。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm -C packages/nextclaw test -- src/cli/shared/lib/distribution/nextclaw-distribution.test.ts`：通过。
- `pnpm -C packages/nextclaw smoke:npm-runtime-update`：通过，覆盖 `update --check --json`、`update --json`、`update --apply --json` 和应用后 launcher `--version`。
- `pnpm dev start` + `curl http://127.0.0.1:18793/api/runtime/bootstrap-status`：通过；dev 后端可启动，接口返回 `phase: ready`、`ncpAgent: ready`、`pluginHydration: ready`。本次不做页面验证。
- `curl http://127.0.0.1:55667/api/runtime/update`：复现本地安装版当前异常，接口返回 `status: "blocked"`、`blockReason: "signature-verification-unavailable"`、`errorMessage: "Runtime bundle updates require a configured update public key."`。同时确认 `/Users/peiwang/.nvm/versions/node/v22.16.0/lib/node_modules/nextclaw/resources/update-bundle-public.pem` 存在，因此根因不是安装包缺少公钥文件，而是旧运行链路没有统一发行包路径 owner，导致更新链路没有拿到正确的 packaged public key。
- `pnpm lint:new-code:governance`：当前被工作区既有脏改动阻塞，剩余项为 `packages/nextclaw-core/src/features/session/stores/session.store.ts` 的 `shared/lib/core-utils` 深层导入；本次新增的 distribution 模块 file role 和 shared/lib index 契约已通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-service/src/index.ts packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts packages/nextclaw-service/src/shared/services/runtime/runtime-command.service.ts packages/nextclaw-service/src/shared/services/runtime/service-managed-startup.service.ts packages/nextclaw-service/src/shared/services/runtime/nextclaw-distribution.service.ts packages/nextclaw-service/src/shared/services/ui/npm-runtime-update-host.service.ts packages/nextclaw-service/src/shared/services/ui/tests/npm-runtime-update-host.service.test.ts packages/nextclaw-service/src/shared/types/distribution.types.ts packages/nextclaw-service/src/shared/utils/cli.utils.ts packages/nextclaw-service/src/shared/utils/cli.utils.ui-static-dir.test.ts packages/nextclaw-service/src/shared/utils/package/package-manifest.utils.ts packages/nextclaw/src/cli/app/index.ts packages/nextclaw/src/cli/launcher/index.ts packages/nextclaw/src/cli/shared/lib/distribution/index.ts packages/nextclaw/src/cli/shared/lib/distribution/nextclaw-distribution.test.ts packages/nextclaw/src/cli/shared/lib/distribution/nextclaw-distribution.utils.ts packages/nextclaw/src/cli/shared/lib/package-version/index.ts packages/nextclaw/src/cli/shared/lib/package-version/package-version.utils.ts`：通过；非测试代码净减 2 行。

## 发布/部署方式

- 本次未执行发布或部署。

## 用户/产品视角的验收步骤

- 当 `/api/runtime/update` 返回 `status: "blocked"` 时，顶部只显示黄色感叹号，hover 可看到“更新被阻塞”和具体阻塞原因。
- 当返回 `status: "failed"` 时，顶部只显示黄色感叹号，hover 可看到“更新失败”和具体失败原因。
- 顶部不再显示“更新异常”这类无法区分语义的文案。
- 本地发行包更新链路可从 `NextclawDistributionService` 取得 runtime update 公钥路径；缺公钥时属于明确的前置条件阻塞，而不是 UI 文案误报。

## 可维护性总结汇总

- 本次使用现有 update snapshot 作为单一信息源，没有新增平行状态。
- 删除旧的 `desktopUpdatesInlineAttention` 文案键和不再需要的 inline tone helper，非测试代码净减 6 行。
- `post-edit-maintainability-review` 结论：通过。正向减债动作为删除和简化；没有通过压缩语句或隐藏复杂度通过行数闸门。
- 结构治理补充：删除旧的 `package-version` helper 和 service 侧自行倒推 `ui-dist` 的逻辑，把发行包路径事实收敛到 `NextclawDistributionService`；本次 distribution owner 范围的非测试代码净减 2 行。

## NPM 包发布记录

- 不涉及 NPM 包发布。
