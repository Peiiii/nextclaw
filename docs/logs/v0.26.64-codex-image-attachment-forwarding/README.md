# v0.26.64 Codex 图片附件转发修复

## 迭代完成说明

本次修复了 NextClaw 会话经 NARP stdio 接入 Codex 时，用户消息中的图片附件在进入 Codex 前被丢弃、模型只收到文本的问题。

根因经端到端证据确认：NCP journal 已保存 `file` part 和有效 `assetUri`，但 kernel 创建 stdio runtime 时没有继续传递已有的 `resolveAssetContentPath`；随后 stdio client 和 NARP wrapper 又各自通过 text-only extractor 把消息降级成纯文本，最终 Codex rollout 中出现 `local_images: []`。Codex app-server runtime 自身已有 `file://` 图片转 `localImage` 的正确能力，因此根因不在 Codex SDK 层。

修复将链路收敛为一条标准路径：`NCP file(assetUri) -> kernel asset resolver -> ACP resource_link(file://) -> NARP wrapper NCP file(url) -> Codex localImage`。同时删除两处 text-only 降级逻辑，保持图片与文本的原始顺序和文件元数据；资源不能解析、URL 不是绝对 URI、或仅提供不受该传输支持的 inline Base64 时，均显式失败，不再静默让模型假装看到了图片。

stdio client 继续使用包自身既有的 `@stdio-runtime-client/` 内部导入合同；server、service 与产品包的 Vitest 配置同步解析该包级别名，使通过 workspace 源码加载 kernel/runtime 的测试无需临时配置，也没有向消费者 `tsconfig` 添加跨包源码 alias。

为防止回归，四层边界均补了可执行合同：kernel resolver 透传、stdio client 真实子进程 ACP prompt、wrapper resource link 还原、Codex local image 映射；Codex 包默认 `test` 脚本也纳入了原先漏跑的 runtime 测试文件。

## 测试/验证/验收方式

- TDD RED：修复前新增的 stdio 附件测试确认只能收到文本且无法解析资源时错误地继续运行；wrapper 测试确认 `resource_link` 被丢弃；kernel 测试确认 resolver 未传递。Codex 映射测试在生产代码未改动时已通过，证明下游能力本来正确。
- TypeScript：`@nextclaw/nextclaw-ncp-runtime-stdio-client`、`@nextclaw/nextclaw-narp-stdio-runtime-wrapper`、`@nextclaw/kernel`、`@nextclaw/nextclaw-ncp-runtime-codex-sdk` 的 `tsc` 全部通过。
- 测试：stdio client 3 files / 21 tests、wrapper 1 file / 4 tests、kernel 定向 1 file / 5 tests、Codex SDK 9 files / 32 tests 全部通过。
- 并行工作区隔离：收尾期间另一个任务新增的 `inbox-delivery-context.provider.ts` 暂时存在 `TS18048`，导致共享工作区的 kernel 全包复跑失败。已从当前 HEAD 创建临时 detached worktree，仅应用本轮图片补丁并链接现有依赖；上述四包 `tsc` 和全部定向测试再次通过，验证后已移除临时 worktree。该并行文件不属于本轮范围，本次未修改。
- Lint：四个受影响包均为 0 error；Codex SDK 保留 1 条来自未触达旧文件 `codex-sdk-ncp-event-mapper.utils.ts` 的既有 warning。
- 治理：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean` 通过。
- 消费链测试：server 路由测试 3/3、产品包测试 8/8 通过；service 排除既有 cron dev 子进程环境用例后 47 个文件、171 条测试全部通过，完整套件也已确认不再出现 stdio client 别名解析失败。
- 真实链路冒烟：在本地开发服务创建隔离会话 `smoke-codex-image-msgaaf8q`，发送原问题中的同一张 2260×870 PNG，并要求只读出“工作职责”下第一个加粗括号标签。模型返回“核心业务”，NCP 终态为 `run.finished`；对应 Codex rollout 的 `local_images` 包含原图绝对路径，证明图片确实到达模型而不是靠文本猜测。

## 发布/部署方式

本次修复随当前本地提交纳入版本历史；未执行推送、NPM 发布、部署或人工重启。开发服务自身的 watch 热更新加载了源码，真实冒烟仅创建隔离测试会话，没有修改原问题会话。

该修复需要随下一次常规 NPM 发布带出；已新增 patch changeset。它不涉及数据库 migration、远程部署或桌面安装包专项发布。

## 用户/产品视角的验收步骤

1. 在使用 Codex NARP stdio runtime 的会话中附加一张包含可辨识文字的图片。
2. 让 Codex 只回答图片中的指定文字，不在文本提示中泄露答案。
3. 预期模型正确回答，且 Codex rollout 中出现对应 `local_images` 路径。
4. 再发送一个无法解析的 `assetUri`，预期会话返回明确失败事件和资源 URI，而不是继续生成一个没有看图的回答。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 复核。本次按非功能 bugfix 统计：总代码 `+348/-26`，净增 322 行；非测试代码 `+117/-24`，净增 93 行。
- 本次净增长是为补齐之前不存在的附件传输合同、显式错误和跨层回归覆盖，不是新增平行链路；同时删除了 client 与 wrapper 两套 text-only extractor，统一为唯一内容映射主链路，没有新增 adapter、service 或兼容 fallback。
- 记录必要增长豁免：非测试语义代码净增 93 行，未满足默认 `<= 0` 门槛。不能通过压行或隐藏分支伪造减量；本次以真实端到端正确性和可观察失败为优先，豁免限定在附件合同实现范围。
- 红区触达：`packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 原 833 行，本次净增 5 行至 838 行。逻辑主体已放在 `stdio-runtime-input.utils.ts`，service 只保留配置注入和调用；后续拆分缝是把 session 进程编排与 run controller 从该 service 分离，本次不为行数门槛扩大重构范围。
- 新测试使用现有 `__tests__` 协议容器，并更新模块结构合同；文件命名、角色和跨目录 alias 均通过治理检查。没有把产品语义塞进 Codex 专属分支，owner 边界比修复前更清晰。

## NPM 包发布记录

已新增 `.changeset/codex-image-attachment-forwarding.md`，以下包均为 patch、当前待统一发布：

- `@nextclaw/kernel`：registry 当前为 `0.6.19`；待发布 resolver 透传修复。
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`：registry 当前为 `0.3.16`；待发布 ACP `resource_link` 到 NCP `file` 的保真映射。
- `@nextclaw/nextclaw-ncp-runtime-stdio-client`：registry 当前为 `0.3.18`；待发布 NCP attachment 到 ACP prompt 的保真映射与显式错误。

`@nextclaw/nextclaw-ncp-runtime-codex-sdk` 仅增加回归测试并修正默认测试入口，生产行为未变，因此不需要版本 bump。当前未执行任何 NPM 发布。
