# 渠道 Extension 迁移实施计划

> **给实施者：** 按任务逐步执行；每个任务完成后先验证，再进入下一步。

**目标：** 把剩余一方渠道从旧的 OpenClaw 兼容 channel plugin 路径迁移到 NextClaw extension channel controller 路径，同时直接删除不再需要的 `mochat` 渠道。

**架构：** Extension SDK 负责通用的渠道生命周期、配置读取、入站消息提交、NCP 事件转发、outbound text 请求处理、控制消息转发和命令调用协议。每个渠道包只负责自己的账号、平台传输、消息解析和发送行为。最终态不再保留 `@nextclaw/channel-runtime` 作为一方渠道共享运行时；渠道特定实现已经落回各自 extension 包。

**技术栈：** TypeScript、`@nextclaw/extension-sdk`、NextClaw extension manifest、Vitest、`tsc`、eslint。

---

## 当前状态

- 新的 extension channel 机制已经用于全部一方渠道：`feishu`、`weixin`、`qq`、`dingtalk`、`wecom`、`slack`、`email`、`whatsapp`、`telegram`、`discord`。
- `mochat` 已删除，不再作为内置渠道保留。
- 旧的一方 `channel-plugin-*` 包和 `@nextclaw/channel-runtime` 已删除。
- OpenClaw compat 仍保留第三方插件兼容能力，但不再内置加载一方 channel plugin。
- `ChannelManager` 已删除 `registration.channel.nextclaw.createChannel(...)` in-process 渠道创建路径。
- Kernel/service/desktop/root scripts 已切到 extension package 和 manifest discovery。

## 设计原则

- `deletion-first`：`mochat` 产品价值和 owner 不清楚，不迁移，直接删除。
- `single-domain-owner`：一个渠道迁移后，只保留一个有效贡献路径，不能同时存在 `channel-plugin-*` 和 `channel-extension-*`。
- `no-legacy-runtime-dependency-final-state`：迁移完成态下，一方 channel extension 不应依赖 `openclaw-compat`、旧 `channel-plugin-*` 或 `@nextclaw/channel-runtime`；`@nextclaw/channel-runtime` 只允许作为迁移期复用旧实现的临时脚手架。
- `responsibility-surface-minimization`：SDK 抽象只承载通用 channel extension 协议行为。
- `protected-variations`：渠道特定协议行为留在渠道实现里。
- `no-compatibility-by-default`：除非 review 时确认有真实外部兼容要求，否则不保留旧 alias 或重复 plugin 包。

## 已定方向

1. 用 `qq` 作为第一个迁移试点。
2. 在大批量迁移前先删除 `mochat`。
3. 迁移期暂时保留 `@nextclaw/channel-runtime` 作为旧渠道实现库；最终清理阶段已删除。
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

状态：已完成第一批迁移。

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
7. Review 后提交。

预期：每个渠道只有一个有效贡献路径。

完成记录：

- 已新增 `nextclaw-channel-extension-dingtalk`、`nextclaw-channel-extension-wecom`、`nextclaw-channel-extension-slack`、`nextclaw-channel-extension-email`、`nextclaw-channel-extension-whatsapp`。
- 已删除对应旧 `nextclaw-channel-plugin-*` wrapper 包。
- 已把 service builtin extension、desktop 依赖、root build/lint/tsc 脚本、kernel discovery 测试切到新 extension 包。
- 已从 OpenClaw compat bundled channel plugin 列表中移除这 5 个旧包；`telegram` 和 `discord` 仍留在旧路径等待任务 6。

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

完成记录：

- 已新增 `nextclaw-channel-extension-telegram` 和 `nextclaw-channel-extension-discord`。
- Telegram/Discord 的平台实现已从旧 `@nextclaw/channel-runtime` 搬入各自 extension 包。
- 通用 extension 协议新增 command list / command execute ingress，用于 Telegram 文本命令和 Discord slash command，不再让渠道包直接依赖 `SessionManager` / `CommandRegistry`。
- SDK 新增通用 `ChannelTypingController`，替代旧 runtime typing controller。
- Extension channel outbound 控制消息统一通过 extension outbound bridge 转发，避免 Telegram/Discord 在宿主内进程分支处理。
- SDK 中没有加入 Telegram/Discord 特定逻辑。

### 任务 6 内部拆分记录

任务 6 完成后继续补了一轮 extension 内部可维护性拆分：

- Telegram：拆出 `telegram-stream-preview.controller.ts` 和 `telegram-message.utils.ts`，主 service 不再承载流式预览 flush 细节、markdown 转 HTML、媒体类型解析和 ack reaction 判定。
- Discord：拆出 `discord-command.utils.ts`、`discord-text.utils.ts`、`discord-draft-streaming.service.ts`，主 service 不再承载 slash command option 映射、文本分块和 draft streaming 细节。
- Email：拆分 IMAP 单封邮件处理和 processed uid 维护。
- Slack：拆分 event context 解析、派发判定和 ack reaction。
- Desktop package build：拆出共享 build steps，避免平台打包入口继续膨胀。

当前目标不是把所有渠道内部做到最终优雅，而是确保最终迁移不会引入新的超长主 service 和超长函数债务。
- Email：`fetchNewMessages` 语句数偏高。

这些问题不阻塞旧 runtime 删除和 extension 主链路切换，但下一阶段应把平台适配拆成 sender / inbound normalizer / stream chunker / attachment adapter 等更小 owner，而不是继续在单文件里堆积。

## 全量迁移后的非插件侧清理计划

本节记录一个容易在后续遗忘的目标：**所有一方渠道都迁移到 extension channel 后，宿主侧应该继续删除旧 channel plugin 兼容链路，而不是只停在“旧渠道都能跑在 extension 里”。**

### 清理前置条件

只有同时满足下面条件，才能进入本节清理：

- `telegram`、`whatsapp`、`discord`、`dingtalk`、`wecom`、`email`、`slack` 全部拥有 `nextclaw-channel-extension-<id>` 包和 `nextclaw.extension.json`。
- 旧 `channel-plugin-*` 包不再是任何一方渠道的唯一贡献路径。
- `ChannelManager` 启动渠道时，所有一方渠道都能通过 manifest channel contribution 进入。
- `channels list`、配置 UI、auth/login、outbound reply 和真实或替代 smoke 都已经覆盖新 extension 路径。
- 没有仍依赖旧 `channel.nextclaw.createChannel` 的一方渠道。

### 必须保留的产品概念

不要因为删除旧 plugin/runtime 链路而删除这些上层概念：

- `channels.<id>`：仍然是用户理解和管理渠道配置的统一入口。
- extension manifest 的 `configSchema` / `configUiHints`：作为渠道配置 UI 和校验的事实来源。
- extension channel 的 inbound/outbound/auth 通用协议：这是新主链路。
- marketplace / plugin 管理能力：它们仍然服务 extension 生态，只是不应再为一方渠道保留旧 OpenClaw channel plugin 适配。

### 最终依赖边界

所有一方渠道迁移完成后的目标依赖边界：

- 一方 `nextclaw-channel-extension-*` 包不依赖 `@nextclaw/openclaw-compat`。
- 一方 `nextclaw-channel-extension-*` 包不依赖旧 `@nextclaw/channel-plugin-*`。
- 一方 `nextclaw-channel-extension-*` 包不再依赖 `@nextclaw/channel-runtime`；渠道特定实现应落在各自 extension 包内，或落在明确不是旧 runtime 兼容层的新共享包内。
- `@nextclaw/channel-runtime` 和旧一方 `channel-plugin-*` 包应删除。
- `openclaw-compat` 可以继续服务第三方 OpenClaw 兼容插件生态，但不能再承载一方内置渠道的启动路径。

### 第一批：删除旧渠道运行时包和旧渠道插件包

**可删除：**

- `packages/extensions/nextclaw-channel-runtime`
- `packages/extensions/nextclaw-channel-plugin-dingtalk`
- `packages/extensions/nextclaw-channel-plugin-discord`
- `packages/extensions/nextclaw-channel-plugin-email`
- `packages/extensions/nextclaw-channel-plugin-slack`
- `packages/extensions/nextclaw-channel-plugin-telegram`
- `packages/extensions/nextclaw-channel-plugin-wecom`
- `packages/extensions/nextclaw-channel-plugin-whatsapp`
- 已删除或未恢复的 `nextclaw-channel-plugin-mochat`、`nextclaw-channel-plugin-qq` 不应重新引入。

**同步修改：**

- 根 `package.json` 的 `build`、`lint`、`tsc` 脚本移除这些包。
- `apps/desktop/package.json` 移除旧 channel plugin 包和 `@nextclaw/channel-runtime`。
- `packages/nextclaw-openclaw-compat/package.json` 移除旧 channel plugin 包和 `@nextclaw/channel-runtime`。
- `pnpm-lock.yaml` 删除对应 importer 和依赖边。

**验收：**

```bash
rg "@nextclaw/channel-runtime|nextclaw-channel-plugin-|@nextclaw/channel-plugin-" package.json packages apps scripts pnpm-lock.yaml
```

预期：除历史 changelog、旧迭代记录或本迁移说明外，active code/package/script 里不再出现旧一方 channel plugin/runtime 依赖。

完成记录：

- 已删除 `packages/extensions/nextclaw-channel-runtime`。
- 已删除旧 Telegram/Discord channel plugin 包，并清理其它已迁移渠道的旧 plugin 残留目录。
- 已移除 service/desktop/root/package lock 对旧包的依赖。
- 已更新 desktop package build/verify 脚本，构建一方 channel extension 包，不再构建旧 runtime。

### 第二批：删除旧 bundled channel plugin 装配层

旧 bundled channel plugin 装配层的职责是把一方 `channel-plugin-*` 作为内置 OpenClaw plugin 加载。所有渠道迁移后，这条链路应删除。

**重点文件：**

- `packages/nextclaw-openclaw-compat/src/plugins/bundled-channel-plugin-packages.constants.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/bundled-channel-plugin-module.utils.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/openclaw-plugin-loader.utils.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/progressive-plugin-loader/progressive-bundled-plugin-loader.ts`
- `packages/nextclaw-openclaw-compat/src/plugins/plugin-status.utils.ts`
- `packages/nextclaw-openclaw-compat/src/plugin-sdk/index.ts`

**要删除的语义：**

- `BUNDLED_CHANNEL_PLUGIN_PACKAGES`
- `loadInProcessBundledPluginModule`
- bundled channel plugin append/load 分支
- `createNextclawBuiltinChannelPlugin`
- 只为旧一方渠道服务的 bundled enable/status 测试

**注意：**

不要删除 OpenClaw compat 的外部插件加载能力本身。这里删的是“一方渠道旧内置 plugin 包装层”，不是整个第三方插件兼容层。

完成记录：

- 已删除 bundled channel plugin 包列表、in-process bundled module loader、progressive bundled loader 和对应 bundled enable/status 测试。
- 已从 OpenClaw plugin loader/status 路径移除一方 bundled channel append/load 分支。
- 已删除 `createNextclawBuiltinChannelPlugin`。
- `openclaw-compat` 继续保留外部插件 install/load/status/uninstall 能力。

### 第三批：收敛 ChannelManager 的双路径

当前 `ChannelManager` 同时支持：

- 旧路径：`registration.channel.nextclaw.createChannel(...)`
- 新路径：`new ExtensionChannelAdapter(...)`

所有渠道迁移完成后，旧路径应删除。

**修改目标：**

- `packages/nextclaw-core/src/features/channels/managers/channel.manager.ts`
- `packages/nextclaw-core/src/features/channels/services/extension-channel.service.ts`
- `packages/nextclaw-core/src/features/channels/services/base.ts`

**预期形态：**

- `ChannelManager` 只接收 extension channel registration。
- outbound 投递只走 extension channel outbound client。
- 不再需要从宿主进程 new 渠道 SDK runtime。
- `BaseChannel` 若只剩 extension adapter 使用，应继续评估是否删除或改成更薄的 outbound delivery owner。

完成记录：

- `ChannelManager` 已删除 `registration.channel.nextclaw.createChannel(...)` 分支。
- Core `ExtensionChannel` 类型已删除 `nextclaw` 字段。
- `ExtensionChannelAdapter` 负责把 outbound/control message 转发给 extension outbound handler。

**验收：**

```bash
rg "channel\\.nextclaw|createChannel\\(|resolveBuiltinChannelRuntime|BaseChannel" packages/nextclaw-core packages/nextclaw-openclaw-compat
```

预期：不再存在一方渠道 in-process runtime 创建路径；若 `BaseChannel` 仍存在，必须有清楚的新职责说明。

### 第四批：删除旧 plugin channel config projection

当前 `toPluginConfigView` / `mergePluginConfigView` 是为了把旧插件配置投影成 `channels.<id>` 视图。迁移完成后，所有一方渠道配置应直接存放在 `channels.<id>`，manifest 只提供 schema/hints，不需要旧投影桥。

**重点文件：**

- `packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.utils.ts`
- `packages/nextclaw-kernel/src/managers/extension.manager.ts`
- `packages/nextclaw-server/src/features/config/utils/plugin-channel-config-projection.utils.ts`
- `packages/nextclaw-service/src/commands/channel/channel-config-view.ts`
- `packages/nextclaw-service/src/cli/commands/config/services/config-commands.service.ts`
- `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-plugin.manager.ts`

**目标：**

- 删除或改名 `PluginChannelBinding`，不要让新 extension channel 继续背旧 OpenClaw plugin channel 名字。
- 删除 `toPluginConfigView` / `mergePluginConfigView` 对一方渠道的依赖。
- 配置 UI、CLI config set/get、channel login 都直接面向 `channels.<id>`。
- extension manifest channel catalog 成为 UI metadata、channel list、auth/outbound 能力的唯一来源。

**验收：**

```bash
rg "toPluginConfigView|mergePluginConfigView|PluginChannelBinding|getPluginChannelBindings" packages/nextclaw-kernel packages/nextclaw-service packages/nextclaw-server packages/nextclaw-core
```

预期：一方渠道路径不再依赖这些旧投影函数。若第三方 OpenClaw plugin 兼容仍需要它们，应隔离到 compat 内部，不让 NextClaw 主链路继续感知。

### 第五批：收敛配置 schema、labels、help 的渠道硬编码

所有渠道迁到 extension manifest 后，core config 不应继续内置每个渠道的详细字段。

**保留：**

- `channels` 作为配置根对象。
- 通用 `enabled` / account / auth 状态约定。
- 必要的历史配置迁移逻辑。

**清理：**

- `packages/nextclaw-core/src/features/config/configs/schema.ts` 中旧渠道专属 typed schema。
- `packages/nextclaw-core/src/features/config/configs/schema.labels.ts` 中旧渠道字段硬编码。
- `packages/nextclaw-core/src/features/config/configs/schema.help.ts` 中旧渠道字段硬编码。
- 与旧 typed builtin channel schema 强绑定的测试。

**替代来源：**

- extension manifest `contributes.channels[].configSchema`
- extension manifest `contributes.channels[].configUiHints`
- kernel/server 聚合后的 extension channel catalog

### 第六批：清理 marketplace 和开发源里的旧命名

迁移完成后，marketplace 和 dev-source 里仍可能残留 `channel-plugin-*` 作为一方渠道默认包名。

**重点文件：**

- `packages/nextclaw-server/src/features/marketplace/configs/marketplace.constants.config.ts`
- `packages/nextclaw-kernel/src/features/extension-development-source/utils/*`
- `packages/nextclaw-service/src/shared/services/marketplace/tests/*`
- marketplace content/router 测试里引用的 `@nextclaw/channel-plugin-*` 示例。

**目标：**

- 一方渠道统一展示为 `@nextclaw/channel-extension-<id>`。
- 旧 `channel-plugin-*` 只允许出现在历史文档、迁移说明或第三方兼容测试里。

### 推荐执行顺序

1. 迁完剩余 extension channel。
2. 删除旧 channel plugin 包和 `@nextclaw/channel-runtime`。
3. 删除 openclaw-compat 的 bundled channel plugin 装配层。
4. 收敛 `ChannelManager`，只保留 extension outbound delivery。
5. 删除 plugin channel config projection 对一方渠道的主链路影响。
6. 收敛 core config schema/labels/help 的渠道硬编码。
7. 清理 marketplace/dev-source 的旧 `channel-plugin-*` 命名。

每一步都必须先跑引用搜索，再删代码。不要靠“理论上应该没用了”直接删除。

## 验证门槛

实施完成前必须通过：

```bash
pnpm -C packages/nextclaw-extension-sdk test
pnpm -C packages/nextclaw-extension-sdk tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-core tsc
pnpm check:governance-backlog-ratchet
git diff --check
```

每个已迁移 channel package 还要运行：

```bash
pnpm -C packages/extensions/nextclaw-channel-extension-<id> tsc
pnpm -C packages/extensions/nextclaw-channel-extension-<id> lint
```

最后运行 `pnpm lint:new-code:governance`，若被无关既有问题阻塞，需要单独记录。

最终清理阶段实际增加的必要验证还包括：

```bash
pnpm -C packages/extensions/nextclaw-channel-extension-telegram tsc
pnpm -C packages/extensions/nextclaw-channel-extension-discord tsc
pnpm -C packages/nextclaw-core test -- src/features/channels/managers/channel.manager.test.ts --run
pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts src/managers/__tests__/extension.manager.test.ts src/features/extension-development-source/utils/dev-plugin-overrides.utils.test.ts --run
pnpm -C packages/nextclaw-openclaw-compat test -- src/plugins/plugin-channel-bindings.test.ts src/plugins/install.test.ts src/plugins/uninstall.test.ts src/plugins/status.pure-read.test.ts --run
pnpm -C packages/nextclaw-service test -- src/commands/channel/builtin-channels.test.ts src/commands/channel/channels.test.ts src/commands/channel/channel-config-view.test.ts src/shared/services/marketplace/tests/marketplace-plugin-management.service.test.ts src/shared/services/marketplace/tests/marketplace-summary.service.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts --run
pnpm -C packages/nextclaw-server test -- src/app/router.marketplace-content.test.ts src/app/router.marketplace-manage.test.ts --run
pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/utils/marketplace-installed-cache.utils.test.ts --run
node --test scripts/dev/dev-plugin-overrides-support.test.mjs
```

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
