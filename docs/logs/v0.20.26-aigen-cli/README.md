# v0.20.26 aigen CLI

## 迭代完成说明

本次新增独立 `@nextclaw/aigen` workspace package，目录为 `packages/aigen`，binary 为 `aigen`。第一条可运行链路只实现 OpenRouter provider runtime，支持：

- `aigen providers list/get/add/update/remove`
- `aigen models list/get/add/update/remove`
- `aigen models list --remote`
- `aigen secrets list/get/set/remove`
- `aigen image --json`
- `aigen doctor`

实现按 owner 分层：controller 负责 CLI 命令入口，manager 负责生成流程与 runtime 选择，repository 负责本地 `config.json` / `secrets.json`，provider 只负责 OpenRouter 协议适配，output manager 唯一负责文件落盘。

后续纠偏中已将 CLI 出口层从自研 `command/action/flags` parser 收敛到 `commander`。`register-aigen-commands.ts` 是唯一命令树注册入口，`commander` 负责参数解析、必填项、数值 option parser、help/version 和未知参数错误；`AigenApp` 只负责应用装配、输出捕获和错误转换；controller 只接收明确 options，不再自行解析通用 CLI flags。

## 测试/验证/验收方式

- `pnpm -C packages/aigen tsc`
- `pnpm -C packages/aigen test`
- `pnpm -C packages/aigen lint`
- `pnpm -C packages/aigen build`
- CLI 出口层单测：覆盖 commander provider 命令树、`--json` 兼容标记、数值参数错误的稳定 JSON 失败输出。
- 真实 OpenRouter 冒烟：使用隔离 `AIGEN_HOME` 和系统临时输出目录，通过 `x-ai/grok-imagine-image-quality` 生成 JPEG 图片，确认远程模型可发现、secret 只输出 masked value、本地文件落盘成功。
- commander 重构后真实 OpenRouter 冒烟：使用构建后的 `dist/app/main.js` 生成 `commander-smoke.jpg`，确认新出口层未破坏真实 OpenRouter 主链路。
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm clean:generated`
- `pnpm check:generated-clean`

`pnpm lint:new-code:governance` 已运行到 module-structure、package-public-imports、class-methods-arrow 均通过；最终被工作区中无关既有改动 `packages/nextclaw-client-sdk/src/nextclaw-client.test.ts` 的 object-methods-arrow 问题阻塞。

## 发布/部署方式

本次未发布、未部署。新增 package 已接入 root `build` / `lint` / `tsc` 脚本，后续发布按统一 NPM 发布流程执行。

## 用户/产品视角的验收步骤

1. 准备隔离 `AIGEN_HOME`。
2. 执行 `aigen providers add <provider-id> --api-format openrouter --api-base https://openrouter.ai/api/v1 --json`。
3. 执行 `aigen secrets set <provider-id> --stdin --json`，确认输出只包含 masked key 和 fingerprint。
4. 执行 `aigen models list --provider <provider-id> --kind image --remote --json`，确认可发现 OpenRouter image output 模型。
5. 执行 `aigen models add <provider-id>/<model-id> --kind image --generate --max-count 1 --json`。
6. 执行 `aigen image --model <provider-id>/<model-id> --prompt <text> --output-dir <dir> --output-name <name> --json`，确认返回 `assets[]` 且文件存在。

## 可维护性总结汇总

本次是新增用户能力，生产代码净增属于功能实现必要增长。实现遵循单一路径和清晰 owner：OpenRouter 协议细节没有扩散到 controller / manager，secret 原文不进入输出面，文件落盘集中在 `OutputFileManager`，provider/model route 解析集中在 `route.utils.ts`。

本次重构删除了自研通用 CLI parser，避免在 aigen 内维护一套低质量 commander 替代品；保留的 `route.utils.ts` 只承担 `<provider-id>/<provider-local-model>` 这种业务格式校验。

针对触达文件的 maintainability guard 结果：Errors 0，Warnings 0。目录、文件角色、module-structure 在 aigen 相关变更上通过治理检查。新增抽象是为隔离协议适配、持久化、输出落盘和 CLI 命令表面，不是空心中转层。

## NPM 包发布记录

涉及新增 NPM 包：`@nextclaw/aigen`。

- 当前状态：新增 workspace package，准备按当前仓库 prerelease 通道发布。
- 是否需要发布：用户要求针对该包提交并发布 NPM。
- 发布范围：仅 `@nextclaw/aigen`，该包无 workspace runtime 依赖，只依赖 `commander`，窄发布不会影响 `nextclaw` 安装闭包。
- 发布版本：`0.1.0-beta.0`。
- 发布 dist-tag：`beta`。
- 发布状态：提交后执行 NPM 发布并回填 registry 验证结果。
