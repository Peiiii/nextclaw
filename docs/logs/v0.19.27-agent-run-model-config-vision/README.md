# Agent Run Model Config Vision

## 迭代完成说明

本轮解决微信等外部入口在新 agent-run branch 下复用历史图片上下文时，非 vision 模型收到 `image_url` / `input_image` 后触发 provider 反序列化错误的问题。

根因确认：

- 最新微信消息本身是文本，但 session 历史上下文里包含图片消息和截图工具结果。
- 新 branch 会把历史上下文投影进模型输入；旧链路没有在同一位置暴露出这个失败。
- provider 调用前没有按模型能力过滤视觉输入，导致非 vision 模型仍收到图片块。

修复方式：

- provider 配置从旧 `modelThinking` 迁到统一的 `modelConfig[model]`。
- `modelConfig[model].thinking` 承载 thinking 能力。
- `modelConfig[model].vision` 承载模型是否支持视觉输入，缺省为 `false`。
- `LlmProviderManager` 在调用 provider 前按 `vision` 决定是否保留图片块；非 vision 模型会把图片块转成文本说明。
- builtin provider 静态视觉能力从 `visionModels` 迁入 `ProviderSpec.modelConfig`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test src/features/config/configs/loader.nextclaw-provider.test.ts src/features/agent/features/tests/thinking.test.ts`：通过。
- `pnpm -C packages/nextclaw-kernel test src/utils/model-message-vision.utils.test.ts`：通过。
- `pnpm -C packages/nextclaw-service test src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`：通过。
- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/nextclaw-kernel tsc`：通过。
- `pnpm -C packages/nextclaw-runtime tsc`：通过。
- `pnpm -C packages/nextclaw-server tsc`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-service tsc`：通过。
- `pnpm -C packages/nextclaw-client-sdk tsc`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- targeted ESLint：core/kernel/server/ui/service 触达文件均无 error；ui/core 有既有 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：未通过，阻塞于既有命名角色治理规则对历史文件名的触达限制。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：未通过，阻塞项见可维护性总结与红区记录。

## 发布/部署方式

未发布。当前只是本地源码改动，不涉及远程 migration、线上 deploy 或 NPM publish。

## 用户/产品视角的验收步骤

1. 在 provider 配置里为支持视觉输入的模型开启 Vision。
2. 使用微信或其它 channel 进入同一个历史 session，其中历史消息包含图片或截图。
3. 选择未开启 Vision 的模型发送文本消息，应不再出现 `unknown variant imageurl, expected text`。
4. 选择开启 Vision 的模型发送文本消息，历史图片上下文仍可保留给 provider。

## 可维护性总结汇总

本轮按“模型能力归属单模型配置”的方向收敛，避免新增 `visionModels`、`allowImageModels` 或平行 capability map。正向减债包括把 builtin provider 的视觉能力迁入 `modelConfig`，并用 provider 调用前的统一过滤替代 channel/gateway 特判。

遗留阻塞：

- `nextclaw-ncp-runner.utils.ts` 是同批次 agent-run client 迁移留下的超预算文件，需要后续拆出 observer / queue / event match。
- `provider-form.tsx` 和 `provider-models-section.tsx` 已是超长 UI owner，本轮增加 Vision 控制后仍触发增长警告，后续应拆出 provider model config hook 与 model settings popover。
- `pnpm lint:new-code:governance` 仍会因历史文件命名规则阻塞若干已存在文件；本轮没有扩大这些文件的命名债务。

post-edit-maintainability-review：本轮做了复核，结论是“功能修复通过，但工作区级可维护性 guard 仍未闭合”，阻塞项已记录，不能声明治理完全通过。

## 红区触达与减债记录

### packages/nextclaw-server/src/features/config/stores/server-config.store.ts

- 本次是否减债：是。
- 说明：该文件行数从 guard 视角看减少 26 行；删除了局部 `normalizeModelThinkingConfig` 逻辑，复用 core 的 `normalizeProviderModelConfig`，让 provider 配置归一化事实回到共享合同 owner。
- 下一步拆分缝：继续按 provider view 构建、provider update 归一化、runtime config action 三段拆出独立 owner，减少 `server-config.store.ts` 的混合职责。

## NPM 包发布记录

不涉及 NPM 包发布。后续如果合入主线并需要让用户安装新版 CLI/UI，应纳入统一发版批次，至少涉及 `@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/runtime`、`@nextclaw/server`、`@nextclaw/ui`、`@nextclaw/service` 与 `nextclaw` 的影响评估。
