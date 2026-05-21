# 渠道 Extension 迁移实施计划

> **给实施者：** 按任务逐步执行；每个任务完成后先验证，再进入下一步。

**目标：** 把剩余一方渠道从旧的 OpenClaw 兼容 channel plugin 路径迁移到 NextClaw extension channel controller 路径，同时直接删除不再需要的 `mochat` 渠道。

**架构：** Extension SDK 负责通用的渠道生命周期、配置读取、入站消息提交、NCP 事件转发和 outbound text 请求处理。每个渠道包只负责自己的账号、平台传输、消息解析和发送行为。迁移期可以复用现有 `@nextclaw/channel-runtime` 实现，通过通用 bus-channel adapter 接入新 extension 机制；等所有渠道迁移稳定后，再决定保留、改名或拆分该实现包。

**技术栈：** TypeScript、`@nextclaw/extension-sdk`、`@nextclaw/channel-runtime`、NextClaw extension manifest、Vitest、`tsc`、eslint。

---

## 当前状态

- 新的 extension channel 机制已经用于 `feishu` 和 `weixin`。
- 旧的一方 channel plugin 仍然存在：`telegram`、`whatsapp`、`discord`、`mochat`、`dingtalk`、`wecom`、`email`、`slack`、`qq`。
- 旧 plugin 包入口文件很薄，但仍然通过旧的进程内 plugin API 注册渠道。
- 旧渠道的真实行为主要在 `packages/extensions/nextclaw-channel-runtime/src/channels`。
- Kernel 已经支持 extension manifest channel 覆盖同 id 的旧 plugin channel，因此具备安全迁移路径。

## 设计原则

- `deletion-first`：`mochat` 产品价值和 owner 不清楚，不迁移，直接删除。
- `single-domain-owner`：一个渠道迁移后，只保留一个有效贡献路径，不能同时存在 `channel-plugin-*` 和 `channel-extension-*`。
- `responsibility-surface-minimization`：SDK 抽象只承载通用 channel extension 协议行为。
- `protected-variations`：渠道特定协议行为留在渠道实现里。
- `no-compatibility-by-default`：除非 review 时确认有真实外部兼容要求，否则不保留旧 alias 或重复 plugin 包。

## 已定方向

1. 用 `qq` 作为第一个迁移试点。
2. 在大批量迁移前先删除 `mochat`。
3. 迁移期暂时保留 `@nextclaw/channel-runtime` 作为旧渠道实现库。
4. 在 SDK 里新增一个通用 helper，暂定名 `startBusChannelExtension`。
5. QQ 试点证明 helper 足够后，再迁移简单渠道。
6. `telegram` 和 `discord` 最后迁移，因为它们有更多 control message、streaming、typing 和 session 行为。

## 非目标

- 本轮不重构 Feishu 或 Weixin。
- 不把渠道特定行为加进 `@nextclaw/extension-sdk`。
- 在 adapter 路径证明可行前，不重写所有旧渠道实现。
- 不迁移 `mochat`。

## 目标 SDK 形态

目标 extension 包启动代码应接近：

```ts
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { QQChannel } from "@nextclaw/channel-runtime";

await startBusChannelExtension({
  channelId: "qq",
  createChannel: ({ config, bus }) => new QQChannel(config, bus),
  onNcpEventError: warnNcpEventError("qq"),
});
```

该 helper 负责：

- 通过 extension channel API 读取 `channels.<channelId>` 配置；
- 根据 `enabled` 启停底层渠道；
- 把旧 `bus.publishInbound` 调用转换成 `channel.submitMessage`；
- 把 outbound text capability 请求转换成旧渠道的 `channel.send`；
- 当旧渠道已经能消费对应控制消息时，把 NCP event 转成通用 bus/control 路径；
- 防止长轮询类 `start()` 阻塞 extension bootstrap。

该 helper 不负责：

- 账号解析；
- 平台授权细节；
- 消息解析；
- mention 策略；
- 平台 API client；
- typing 实现；
- streaming 渲染策略。

## 任务 1：在 SDK 增加通用 Bus Channel Adapter

**文件：**

- 修改：`packages/nextclaw-extension-sdk/src/services/extension-channel-controller.service.ts`
- 修改：`packages/nextclaw-extension-sdk/src/index.ts`
- 修改：`packages/nextclaw-extension-sdk/src/extension-sdk.test.ts`

**步骤：**

1. 先为 `startBusChannelExtension` 写失败测试。
2. 覆盖旧 bus inbound message 到 `submitMessage` 的转换。
3. 覆盖 outbound text 到旧渠道 `send` 的转换。
4. 覆盖 disabled config 会停止底层渠道。
5. 覆盖长时间运行的 `start()` 不阻塞注册流程。
6. 实现最小通用 adapter。
7. 从 SDK 根入口导出 helper。
8. 运行：

```bash
pnpm -C packages/nextclaw-extension-sdk test
pnpm -C packages/nextclaw-extension-sdk tsc
pnpm -C packages/nextclaw-extension-sdk lint
```

预期：全部通过。

## 任务 2：删除 Mochat 渠道表面

**文件：**

- 删除：`packages/extensions/nextclaw-channel-plugin-mochat`
- 修改：`packages/extensions/nextclaw-channel-runtime/src/index.ts`
- 删除：`packages/extensions/nextclaw-channel-runtime/src/channels/mochat.ts`
- 修改：`packages/nextclaw-core/src/features/config/configs/schema.ts`
- 修改：`packages/nextclaw-runtime/src/channels/builtin-channel.config.ts`
- 修改：`packages/nextclaw-service/src/commands/channel/index.ts`
- 修改枚举 builtin channels 的相关测试。
- 如果根 `package.json` 的 build/lint/tsc 脚本引用 `nextclaw-channel-plugin-mochat`，同步删除。

**步骤：**

1. 从 builtin channel 列表移除 `mochat`。
2. 删除 `MochatConfigSchema` 和 `channels.mochat` typed config 入口。
3. 删除 `MochatChannel` import/export 和 runtime factory。
4. 删除旧 mochat plugin 包。
5. 删除 mochat 专属测试，或更新 builtin channel snapshot。
6. 不创建 mochat extension 包。
7. 运行：

```bash
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-runtime tsc
pnpm -C packages/nextclaw-service test -- src/commands/channel/channels.test.ts --run
pnpm -C packages/extensions/nextclaw-channel-runtime tsc
```

预期：不再存在 active mochat channel code 引用。

Review 备注：历史 changelog 里的 mochat 记录可以保留，除非我们明确决定重写历史类文档。

## 任务 3：把 QQ 迁移为试点 Extension

**文件：**

- 新增：`packages/extensions/nextclaw-channel-extension-qq/package.json`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/nextclaw.extension.json`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/src/main.ts`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/src/index.ts`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/tsconfig.json`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/eslint.config.mjs`
- 新增：`packages/extensions/nextclaw-channel-extension-qq/module-structure.config.json`
- 修改：根 `package.json` build/lint/tsc 脚本。
- 修改：断言一方 extension path 的 discovery 测试。
- 删除或停用：`packages/extensions/nextclaw-channel-plugin-qq`。

**步骤：**

1. 新增 extension package 脚手架。
2. 新增 QQ `nextclaw.extension.json`，`id` 为 `nextclaw-channel-extension-qq`，贡献 channel `qq`。
3. 在 `src/main.ts` 使用 `startBusChannelExtension`。
4. 复用 `@nextclaw/channel-runtime` 的 `QQChannel`。
5. 从根脚本里移除旧 QQ plugin 包。
6. 更新 builtin/discovery 测试，让它们预期 `qq` 来自 extension contribution。
7. 运行：

```bash
pnpm -C packages/extensions/nextclaw-channel-extension-qq tsc
pnpm -C packages/extensions/nextclaw-channel-extension-qq lint
pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run
```

预期：QQ 由 extension manifest 贡献，不再需要旧 QQ plugin 路径。

## 任务 4：QQ 试点运行冒烟

**文件：**

- 除非冒烟暴露具体缺陷，否则不改生产文件。

**步骤：**

1. 构建本地 extension 启动所需包：

```bash
pnpm -C packages/nextclaw-shared build
pnpm -C packages/nextclaw-extension-sdk build
pnpm -C packages/extensions/nextclaw-channel-runtime build
pnpm -C packages/extensions/nextclaw-channel-extension-qq build
```

2. 在 QQ disabled 的配置下启动本地 runtime，确认 QQ extension 进程不崩溃。
3. 确认 channel list 中的 `qq` 来自 extension contribution。
4. 如果有凭证，运行真实 QQ 收发冒烟。
5. 如果没有凭证，记录限制，并保留 deterministic disabled-channel smoke。

预期：没有重复 `qq` 注册，没有旧 plugin 注册，没有 extension 启动崩溃。

## 任务 5：迁移简单旧渠道

**渠道：**

- `dingtalk`
- `wecom`
- `slack`
- `email`
- `whatsapp`

**每个渠道的步骤：**

1. 创建 `packages/extensions/nextclaw-channel-extension-<id>`。
2. 新增 manifest，贡献 channel `<id>`。
3. 使用 `startBusChannelExtension` 启动。
4. 从根脚本中移除旧 `nextclaw-channel-plugin-<id>` 包。
5. 更新 builtin channel 测试。
6. 运行该包 `tsc`、该包 `lint` 和 kernel extension discovery 测试。
7. Review 后每个渠道单独提交。

预期：每个渠道只有一个有效贡献路径。

## 任务 6：最后迁移 Telegram 和 Discord

**原因：**

Telegram 和 Discord 有额外的 typing、streaming preview、slash command、reset handling 和 session access 行为。它们可能会暴露 `startBusChannelExtension` 是否还需要一个更小的通用 hook，但不应该由它们驱动第一版抽象。

**步骤：**

1. Review 当前 `handleControlMessage` 和 NCP event 使用方式。
2. 判断通用 NCP event 到 legacy outbound/control 的转换是否足够。
3. 如果不够，只增加最小必要的通用 SDK hook。
4. 一次迁移一个渠道。
5. 运行真实或最接近真实链路的冒烟。

预期：SDK 中不出现 Telegram/Discord 特定逻辑。

## 验证门槛

实施完成前必须通过：

```bash
pnpm -C packages/nextclaw-extension-sdk test
pnpm -C packages/nextclaw-extension-sdk tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/extensions/nextclaw-channel-runtime tsc
pnpm check:governance-backlog-ratchet
git diff --check
```

每个已迁移 channel package 还要运行：

```bash
pnpm -C packages/extensions/nextclaw-channel-extension-<id> tsc
pnpm -C packages/extensions/nextclaw-channel-extension-<id> lint
```

最后运行 `pnpm lint:new-code:governance`，若被无关既有问题阻塞，需要单独记录。

## Review 检查清单

- `mochat` 删除作为产品决策是否成立？
- 旧 channel plugin 包应该立即删除，还是保留临时 deprecation stub？
- `startBusChannelExtension` 这个 SDK 名字是否合适？
- 该 helper 是否把过多旧 `BaseChannel` 形态暴露到了公开 SDK？
- `@nextclaw/channel-runtime` 迁移后是否继续公开，还是后续变成内部实现包？
- 从当前用户可见使用情况看，QQ 是否仍然是最佳试点？
- 对仍包含 `channels.mochat` 的配置是否需要迁移说明？

## 推荐第一批实施范围

先只实施任务 1 到任务 4：

1. 增加 SDK helper。
2. 删除 `mochat`。
3. 迁移 QQ。
4. 运行 QQ disabled-channel smoke 和可用的确定性测试。

QQ 完成后停下来 review。在 adapter 边界经受住一个真实渠道之前，不批量迁移剩余渠道。
