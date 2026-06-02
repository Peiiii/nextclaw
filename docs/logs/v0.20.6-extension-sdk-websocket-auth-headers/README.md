# v0.20.6 Extension SDK WebSocket Auth Headers

## 迭代完成说明

本次修复微信渠道点击“重新生成二维码”后 `auth/start` 一直等待并最终超时的问题。

最底层根因在 `@nextclaw/extension-sdk` 的默认 WebSocket 创建路径：SDK 在 `subscribe()` 中构造了 extension event stream 认证 headers，但默认实现使用 `globalThis.WebSocket(url)` 时没有把 `authorization` 和 `x-nextclaw-extension-id` 传入真实 Node WebSocket。server `/ws` 需要这两个 header 才能认证 extension principal；header 丢失后 extension socket 不能接收 `extension.request`，`channel.auth.start` 只能等到 request-response 超时。

确认方式：

- 接口复现表现为 `POST /api/config/channels/weixin/auth/start` 等待后返回 `AUTH_START_FAILED: Extension request timed out: channel.auth.start`。
- 代码证据显示 SDK default WebSocket 分支丢弃了已构造的 headers，而 server event-stream auth 依赖 bearer token 与 extension id。
- 修复后用 assembled API smoke 走真实 `startUiServer`、`/ws`、`/webhook`、extension SDK 默认 Node WebSocket 与 `POST /api/config/channels/fake-channel/auth/start`，接口在 37ms 返回 `200` 和 QR auth start payload。

修复方式：

- `@nextclaw/extension-sdk` 增加运行时依赖 `ws`，默认 Node WebSocket 直接用 `new WebSocket(url, { headers })`。
- 为默认 `ws` socket 挂载 no-op `error` listener，避免连接失败但调用方未设置 `onerror` 时触发未处理 EventEmitter error。
- 补充 SDK 默认 Node WebSocket 真实握手测试，验证 `authorization` 与 `x-nextclaw-extension-id` 会出现在服务端收到的 handshake headers 中。
- 拆分 extension SDK 过大的 bus channel reply 测试块，避免 `extension-sdk.test.ts` 继续膨胀。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/extension-sdk test`：通过，3 个测试文件、18 个用例。
- `pnpm --filter @nextclaw/extension-sdk tsc`：通过。
- `pnpm --filter @nextclaw/extension-sdk lint`：通过。
- `pnpm --filter @nextclaw/extension-sdk build`：通过；`tsdown` 提示当前 Node.js v22.16.0 后续会被弃用，需后续升级到 v22.18.0 或更高。
- 功能验证：assembled API smoke 使用临时非仓库目录配置，真实启动 `startUiServer`，extension SDK 使用默认 Node WebSocket 连接 `/ws`，再调用 `POST /api/config/channels/fake-channel/auth/start`；结果 `status=200`、`ms=37`，响应包含 `kind: "qr_code"`、`sessionId`、`qrCode`、`qrCodeUrl`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本次触达文件>`：通过，0 errors，1 warning；统计为 total +277 / -156 / net +121，non-test +4 / -4 / net 0。
- `pnpm lint:new-code:governance -- packages/nextclaw-extension-sdk/src packages/nextclaw-extension-sdk/package.json pnpm-lock.yaml docs/designs/2026-06-02-weixin-channel-auth-timeout-root-cause.md`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance` 全量 diff 被工作区内非本次触达的 `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx` parent-relative imports 阻塞；本次未修改该 UI 文件，已改跑本次触达面的 targeted governance。

## 发布/部署方式

已执行 NPM stable full public workspace publish。本次没有发布 desktop installer、runtime update channel 或部署服务。

发布方式：

- 使用隔离 worktree `/Users/peiwang/Projects/nextbot-release-extension-sdk`，从已提交修复 `2e6117cd8` 创建 release branch `codex/release-extension-sdk-stable`。
- 避免把当前主工作区中未完成的 provider/model/llm-provider WIP 带入发布。
- 先做过一次受控窄发布：`@nextclaw/extension-sdk@0.2.3` 与 `@nextclaw/channel-extension-weixin@0.1.18`。
- 用户明确纠偏为“全部发布”后，改走 full public workspace batch，发布全部 47 个公开 workspace NPM 包。
- 全量发布使用 `pnpm release:auto:changeset`、`pnpm release:version`、`pnpm release:publish`；发布前将全量 version/changelog commit 固定为 `4439824f3 Release all public packages stable`，确保 release tags 指向包含 release metadata 的 commit。
- 使用项目 `.npmrc` 作为 npm auth 来源：`NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc`。

## 用户/产品视角的验收步骤

1. 启动服务并确保微信 channel extension 使用运行时注入的 `NEXTCLAW_EXTENSION_ID` 与 `NEXTCLAW_EXTENSION_TOKEN`。
2. 在微信渠道配置中点击“重新生成二维码”。
3. 预期 `auth/start` 不再等待到 60 秒超时，而是快速返回二维码 auth start 结果。
4. 若 extension 未启动或 token 错误，应进入后续 readiness/error-message 改进项，而不是被误认为本次 SDK 默认 WebSocket header 修复未生效。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 做收尾复核。

本次是非功能 bugfix，非测试代码净增为 0。正向减债动作是简化和测试拆分：默认 WebSocket 修复收敛到 transport owner 内的 4 行替换，未新增平行 request path；同时把 bus channel reply 测试从接近预算的 `extension-sdk.test.ts` 拆到独立测试文件。

剩余债务：

- `extension-sdk.test.ts` 仍接近文件预算，后续可继续拆 fixtures/builders。
- server 侧 extension readiness 仍可继续改进：有 binding 但 extension 未在线时，应快速返回更具体错误，而不是等待 request timeout。

## NPM 包发布记录

已发布 NPM stable 包。最终全量 stable 批次为 47/47 published：

- `nextclaw@0.20.3`
- `@nextclaw/extension-sdk@0.2.4`
- `@nextclaw/channel-extension-weixin@0.1.19`
- 其他 44 个公开 workspace 包也已在同一批次 patch 发布到 `latest`，完整清单由 `release:verify:published` 的 batch checkpoint 覆盖。

验证记录：

- `pnpm release:check`：通过，覆盖全量发布批次 build 与 tsc。
- `pnpm release:publish`：通过，`release:verify:published` 输出 `published 47/47 package versions`。
- 临时目录安装 `nextclaw@latest`：确认 `nextclaw --version` 为 `0.20.3`。
- 独立 `NEXTCLAW_HOME` 执行 `nextclaw update --check`：通过，输出 runtime 已是最新 `0.20.3`。
- 临时目录安装 `@nextclaw/channel-extension-weixin@latest`：确认安装到 weixin `0.1.19`，实际依赖 SDK `0.2.4`，且 SDK manifest 包含 `ws`。

Release commits:

- `a9c6fb2f8 Release extension SDK websocket auth fix`
- `4439824f3 Release all public packages stable`

关键 tags:

- `nextclaw@0.20.3`
- `@nextclaw/extension-sdk@0.2.4`
- `@nextclaw/channel-extension-weixin@0.1.19`
