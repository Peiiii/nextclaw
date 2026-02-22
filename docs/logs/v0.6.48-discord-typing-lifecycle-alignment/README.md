# v0.6.48-discord-typing-lifecycle-alignment

## 迭代完成说明（改了什么）

本次将 Discord/Telegram typing 生命周期对齐 OpenClaw 的核心思路（运行阶段维持 typing，完成后显式清理），并采用低耦合实现：

- 新增核心控制消息机制：`typing stop` 控制消息（[`packages/nextclaw-core/src/bus/control.ts`](../../../packages/nextclaw-core/src/bus/control.ts)）。
- Agent 在“无回复（含 `<noreply/>`）”路径发布 typing stop 控制消息，避免仅靠超时回收。
- ChannelManager 增加控制消息分流：控制消息走 `handleControlMessage`，不进入正常发送链路。
- Discord/Telegram 渠道增加 `handleControlMessage` 支持，并在控制消息到达时立即停 typing。
- Discord/Telegram 入站流程移除“入站 finally 立刻 stop typing”的旧逻辑，改为仅在入站异常时 stop。
- Discord/Telegram typing 参数更新：heartbeat 调整为 6s、auto-stop 调整为 120s，和 OpenClaw 运行节奏更接近。

## 测试 / 验证 / 验收方式

- 单元测试（已通过）：
  - [`packages/nextclaw-core/src/bus/control.test.ts`](../../../packages/nextclaw-core/src/bus/control.test.ts)
  - [`packages/nextclaw-core/src/channels/manager.typing-control.test.ts`](../../../packages/nextclaw-core/src/channels/manager.typing-control.test.ts)
- 工程校验（已通过）：
  - `pnpm -C packages/nextclaw-core test`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟测试（本地可自动验证部分，已执行）：
  - 通过 manager 控制消息路径验证“control 消息触发 stop 且不走普通发送”。
  - 通过 core 控制消息生成验证“无回复路径可发出 typing stop 控制消息”。
  - 发布后 CLI 安装与入口冒烟（隔离目录）：`NEXTCLAW_HOME=/tmp/... pnpm dlx nextclaw@0.6.26 --help`，命令成功输出子命令清单。
- 冒烟测试（Discord 真实环境，发布后按以下步骤验收）：
  - 在 Discord 发起一条会触发工具执行或长思考的消息，观察 typing 在模型处理期间持续存在，不再“刚开始就消失”。
  - 触发 `<noreply/>` 场景，观察任务结束后 typing 能被快速清理，而非长期悬挂。

### 用户/产品视角验收步骤

1. 在 Discord 群聊 @ 机器人发送复杂问题（例如需要工具调用），确认 typing 会持续到回复前后，而不是数秒内消失。
2. 在 Discord 触发“应静默不回复”的问题，确认不会发送文本回复，同时 typing 在任务完成后会停止。
3. 对比 Telegram 发送同类问题，确认 typing 生命周期行为一致。
4. 验收标准：
   - typing 不早退（处理中可见）；
   - 无回复场景 typing 可回收；
   - 正常回复场景 typing 在发送后停止；
   - 不引入跨模块高耦合改造。

## 发布 / 部署方式

- 发布流程文档：[`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md)。
- 本次闭环已执行：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 已发布版本：
  - `@nextclaw/core@0.6.23`
  - `@nextclaw/channel-runtime@0.1.9`
  - `@nextclaw/openclaw-compat@0.1.16`
  - `@nextclaw/server@0.4.9`
  - `nextclaw@0.6.26`
- 远程 migration：不适用（本次仅 npm 包与运行时行为变更，不涉及后端数据库结构变更）。
