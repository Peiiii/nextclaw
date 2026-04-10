# v0.15.82-weixin-inbound-attachments

## 迭代完成说明

- 为 `@nextclaw/channel-plugin-weixin` 补齐微信入站图片/文件附件链路：微信插件继续负责媒体 URL 解析、下载/解密、临时文件落盘，以及 `InboundAttachment[]` 组装；`WeixinChannel` 只把附件交给现有 `BaseChannel.handleMessage()`，不在渠道层读取文件内容。
- 修复“微信能收到 markdown 文件，但原生 agent 读不到”的根因：此前 `@nextclaw/core` 只会把图片附件转成多模态 user content，非图片附件即使进入 `attachments` 也只剩占位文本。本次为原生 agent 增加统一托管资产接缝，让非图片附件也能变成可导出的 `assetUri`。
- 在 core 层只增加最小扩展点：`InboundAttachment.assetUri`、入站附件预处理、用户内容构建钩子、附加 tool 注入。结构上不再把业务约束散落在函数拼装里，而是把稳定职责收敛到 `DefaultUserContentBuilder` 与 `NativeManagedAssetSupport` 这两个 class；`AgentLoop` 本身只保留最薄的接线，并通过 `runtime-hooks.ts` 处理机械型 runtime glue。core 仍不依赖 `@nextclaw/ncp-agent-runtime`，避免基础层反向耦合到具体资产实现。
- 在 `nextclaw` 包新增 `NativeManagedAssetSupport` class，统一负责本地附件资产化、用户内容构建与资产工具暴露；复用现有 `LocalAssetStore`、`buildLegacyUserContent()` 与 NCP 资产工具，把本地附件统一资产化，并为原生 agent 注入 `asset_export` / `asset_stat` / `asset_put` 等资产工具。
- 服务态 `GatewayAgentRuntimePool` 与 CLI 直连 `AgentLoop` 都接入同一套 native managed asset support，避免“服务里能用、CLI 不能用”的运行时分叉。
- 微信插件补齐常见文本/源码文件的 MIME 识别，特别是 `.md` 会识别为 `text/markdown`，不再无谓退化成 `application/octet-stream`。
- 相关方案文档：[Weixin Inbound Attachments Implementation Plan](../../../docs/plans/2026-04-10-weixin-inbound-attachments-implementation-plan.md)

## 红区触达与减债记录

### packages/nextclaw-core/src/agent/loop.ts

- 本次是否减债：是，局部减债。
- 说明：本次必须触达主循环以加入“附件预处理”和“附加工具注册”接缝，但没有把资产存储、prompt 组装或微信逻辑塞进 `loop.ts`。默认 user content 构建继续下沉到 `DefaultUserContentBuilder` class，而 `AgentLoopRuntimeSupport` 这个过渡类已经被彻底删除，`loop.ts` 只保留最薄接线并回到相对基线净减。
- 下一步拆分缝：先拆 session lookup、tool loop orchestration、response finalization 三段。

## 测试/验证/验收方式

- core 定向单测：
  - `pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts src/agent/tests/loop.tool-catalog.test.ts src/agent/tests/loop.additional-tools.test.ts`
  - 结果：通过，`3 passed / 10 passed`
- nextclaw 定向单测：
  - `pnpm -C packages/nextclaw exec vitest run src/cli/commands/agent/native-managed-asset-support.test.ts src/cli/commands/agent/agent-runtime-pool.command.test.ts`
  - 结果：通过，`2 passed / 10 passed`
- 微信插件定向单测：
  - `pnpm -C packages/extensions/nextclaw-channel-plugin-weixin exec vitest run src/tests/weixin-channel-attachments.test.ts src/tests/weixin-channel.test.ts src/tests/index.test.ts src/tests/weixin-api.client.test.ts`
  - 结果：通过，`4 passed / 10 passed`
- 类型检查与构建：
  - `pnpm -C packages/nextclaw-core tsc`：通过
  - `pnpm -C packages/nextclaw-core build`：通过
  - `pnpm -C packages/extensions/nextclaw-channel-plugin-weixin tsc && pnpm -C packages/extensions/nextclaw-channel-plugin-weixin lint && pnpm -C packages/extensions/nextclaw-channel-plugin-weixin build`：通过
  - `pnpm -C packages/nextclaw tsc`：失败，但剩余错误来自未触达文件 `packages/nextclaw-server/src/ui/ui-routes/marketplace/installed.ts` 的 `Set<string | undefined>` 类型问题；本次新增的 `native-managed-asset-support.ts` type-only import 问题已修复
- lint：
  - `pnpm -C packages/nextclaw-core lint`：通过，剩余为既有 warning
  - `pnpm -C packages/nextclaw lint`：失败，但唯一 error 来自未触达文件 `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-delivery.service.test.ts` 的 `require-yield`；本次新增文件无新增 lint error
- 可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：通过，剩余 warning 为历史热点/目录预算超限但本次未继续恶化；`loop.ts`、`agent-runtime-pool.ts`、`runtime.ts` 已被压到相对基线净减

## 发布/部署方式

- 本次未执行 npm 发布；用户本轮要求先实现与验证，未要求发布闭环。
- 本地或测试环境部署方式：
  1. 重新构建受影响包：`pnpm -C packages/nextclaw-core build`、`pnpm -C packages/extensions/nextclaw-channel-plugin-weixin build`
  2. 重启使用微信插件与原生 agent 的 NextClaw 服务进程
- 不适用：
  - 远程 migration：不涉及数据库变更
  - 独立前端发布：不涉及 UI 产物变更
  - CDN 配置：不需要；入站文件走本地托管资产与 `asset_export`，不是通过公网 CDN 暴露给模型

## 用户/产品视角的验收步骤

1. 启动带本次代码的 NextClaw 服务，并确认微信渠道已登录。
2. 在微信里给机器人发送一个 `notes.md` 文件。
3. 观察服务侧入站消息是否包含 `attachments[0]`，且 `name` 为 `notes.md`、`mimeType` 为 `text/markdown`、`status` 为 `ready`。
4. 进入原生 agent 处理时，附件应先被资产化为 `assetUri`，用户内容里应出现类似 `[Asset: notes.md]`、`[Asset URI: asset://store/...]` 的资产引用，而不是只有 `[收到文件: notes.md]` 占位文本。
5. 让 agent 通过 `asset_export` 导出该资产到普通文件路径，再读取导出的 markdown 内容；这一步应能读到微信发送的文件正文。
6. 回归发送图片和 PDF：图片仍能走原有多模态图片 user content；PDF/其它文件则走同一套 asset 引用和导出工具。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次增强的是 NextClaw 作为统一入口的“文件进入后可被 AI 编排处理”的基础能力，不是给微信单独堆一个 markdown 特判。微信、CLI、服务态原生 agent 都被收敛到同一套托管资产语义，符合“统一体验优先”和“NCP 能力复用优先”。
- 可维护性复核结论：通过。
- 本次顺手减债：是。
- 代码增减报告：
  - 说明：为避免 README 自引用膨胀，以下统计不含本文件；未跟踪新增文件按 `wc -l` 计入。
  - 新增：约 `744` 行
  - 删除：约 `141` 行
  - 净增：约 `+603` 行
- 非测试代码增减报告：
  - 说明：排除 `*.test.*` 与 `tests/`，并不含本 README。
  - 新增：约 `370` 行
  - 删除：约 `87` 行
  - 净增：约 `+283` 行
- 本次是否已尽最大努力优化可维护性：
  - 是。第一版接线虽然能工作，但业务约束更多落在函数拼装上，不符合当前项目的 class-first 标准；收尾阶段已把稳定业务职责收束成 `DefaultUserContentBuilder` 与 `NativeManagedAssetSupport` 两个 class，并删除 `AgentLoopRuntimeSupport` 这个挂在旧宿主上的过渡抽象，同时把 `loop.ts`、`agent-runtime-pool.ts`、`runtime.ts` 压回到相对基线净减或不恶化状态。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”：
  - 是。没有在微信插件里读取 markdown，也没有复制一套文件工具；删除了“非图片附件只能靠占位文本表达”的行为缺口，并复用现有 NCP 资产工具和 content builder。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 本次是新增用户可见能力，总代码量有净增长；增长的最小必要性来自 core 接缝、native asset support 与覆盖测试。
  - 为避免目录平铺恶化，新增 core helper 放在 `agent/content/` 与 `agent/runtime/` 子目录，未继续增加 `agent/` 根目录直连文件数。
  - 为抵消热点压力，本次把 `context.ts` 从基线净减 26 行，`loop.ts` 净减 1 行，`agent-runtime-pool.ts` 净减 1 行，`runtime.ts` 净减 1 行。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：
  - 是。微信插件只做渠道媒体落盘；`DefaultUserContentBuilder` 负责默认附件内容构建；`NativeManagedAssetSupport` 负责托管资产实现与工具注入；`AgentLoop` 只保留主循环本身，机械型接线落在 `runtime-hooks.ts`；NCP 资产内容构建逻辑继续复用原有 `buildLegacyUserContent()`，没有形成微信专属旁路。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 满足本次新增文件治理要求。新增源码使用 kebab-case，且 role 边界清晰：`native-managed-asset-support.ts`、`runtime-hooks.ts`、`user-content.ts`。
  - 仓库仍有既有目录/热点预算 warning，例如 `packages/nextclaw/src/cli`、`packages/nextclaw-core/src/agent/loop.ts`、`packages/nextclaw/src/cli/runtime.ts`；本次已避免继续恶化，并在红区记录里留下下一步拆分缝。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写：
  - 是。本节基于定向 guard、包级验证与独立二次复核，不是只复述守卫输出。
- 还可以继续删除什么：
  - 当前链路里没有明显可删的能力代码；再删会丢失“原生 agent 可读非图片附件”目标。后续可删除的是其它运行时入口里已有的重复资产/附件旁路，如果继续发现与这套托管资产语义重叠，应优先合并到 `native-managed-asset-support.ts`。
- 删不掉的部分还能如何简化：
  - 下一步更大拆分应从 `AgentLoop` 的 session lookup、tool loop orchestration、response finalization 三段开始，而不是继续围绕附件能力加补丁。
- 是否只是把复杂度换个位置保留：
  - 否。复杂度没有继续散落在微信渠道、主循环和 runtime 接线里，而是被收进三个明确的 class 边界；这不是换名保留，而是把能力聚拢到可约束、可扩展、可复用的对象里。
- no maintainability findings
- 可维护性总结：
  - 本次有必要净增长，因为这是新增通用文件可读能力；但增长已被压到清晰边界里，热点文件没有继续膨胀。剩余债务是历史超大运行时文件仍需拆分，本次已把下一步拆分缝记录下来。

## 迭代目录判定

- 是否必须新建迭代：否。
- 判定理由：本次是 `v0.15.82-weixin-inbound-attachments` 同一问题域的连续收尾与验收修正，仍服务于“微信入站附件进入运行时并可被 agent 处理”的同一交付目标；按同批次续改规则，直接更新本 README，不再新建 `docs/logs` 目录。
