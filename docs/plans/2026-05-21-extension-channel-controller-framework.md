# Extension Channel Controller Framework Implementation Plan

**Goal:** 在不引入渠道特例的前提下，把微信和飞书 extension 里重复的 channel 生命周期、配置同步、入站提交、NCP 回复转发和可选 outbound text 桥接收敛为 `@nextclaw/extension-sdk` 的通用 channel controller 框架。

**Architecture:** `@nextclaw/extension-sdk` 提供一个通用 `ExtensionChannelController<TConfig, TInbound>` owner，负责 extension channel 的通用生命周期闭环；每个渠道只提供 adapter、inbound mapper 和可选 capability handler。渠道包继续拥有自己的协议 API、账号存储、auth/registration、消息 parser、路由策略和外部平台发送逻辑。

**Tech Stack:** TypeScript、Vitest、`@nextclaw/extension-sdk`、`@nextclaw/ncp`、现有微信/飞书 extension 包。

---

## 设计原则

- `protected-variations`：外部渠道差异只通过 adapter 与 mapper 暴露，NextClaw 主流程不感知微信/飞书等特例。
- `information-expert`：配置变化、cleanup、start/stop 幂等属于 controller owner；外部协议细节属于 channel adapter。
- `complete-owner`：`ExtensionChannelController` 必须覆盖通用 channel extension 生命周期闭环，不做只转发的空壳。
- `deletion-first`：新增 SDK controller 后删除 `WeixinExtensionRuntime` 与 `FeishuExtensionRuntime` 的重复实现。
- `no-compatibility-by-default`：内部迁移直接改微信/飞书调用方，不保留旧 controller alias。

## 不做什么

- 不把微信 API、飞书 SDK、二维码登录、reaction、group policy、polling、context token 等渠道细节放入 SDK。
- 不新增第二套 extension manifest 格式。
- 不改 kernel/service 的 extension manifest discovery 和 request/response 协议。
- 不迁移其他旧 `channel-plugin-*`，本轮只先打磨 framework 并用微信/飞书验证。

## 目标代码形态

微信 `main.ts` 目标：

```ts
import {
  ExtensionChannelController,
  NextClawExtension,
} from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "./services/weixin-auth-capability.service.js";
import { WeixinChannelAdapter } from "./services/weixin-channel-adapter.service.js";
import { toWeixinSubmittedMessage } from "./utils/weixin-submitted-message.utils.js";

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const extension = new NextClawExtension();
const channel = extension.channels.use("weixin");
const adapter = new WeixinChannelAdapter();

const controller = new ExtensionChannelController({
  channel,
  adapter,
  mapInbound: toWeixinSubmittedMessage,
  onNcpEventError: (error) => {
    console.warn(`[weixin] failed to send NCP event: ${error instanceof Error ? error.message : String(error)}`);
  },
});

extension.capabilities.provide("channel.auth", new WeixinAuthCapability({ channel }));
extension.capabilities.provideHandler("channel.outbound.sendText", async (payload) =>
  await controller.sendOutboundText({
    to: readRequiredString(payload.to, "to"),
    text: readRequiredString(payload.text, "text"),
    accountId: readOptionalString(payload.accountId),
  }),
);

await controller.start();
```

飞书 `main.ts` 目标：

```ts
import { ExtensionChannelController, NextClawExtension } from "@nextclaw/extension-sdk";
import { FeishuAuthCapability } from "./services/feishu-auth-capability.service.js";
import { FeishuChannelAdapter } from "./services/feishu-channel-adapter.service.js";
import { toFeishuSubmittedMessage } from "./utils/feishu-submitted-message.utils.js";

const extension = new NextClawExtension();
const channel = extension.channels.use("feishu");

const controller = new ExtensionChannelController({
  channel,
  adapter: new FeishuChannelAdapter(),
  mapInbound: toFeishuSubmittedMessage,
  onNcpEventError: (error) => {
    console.warn(`[feishu] failed to send NCP event: ${error instanceof Error ? error.message : String(error)}`);
  },
});

extension.capabilities.provide("channel.auth", new FeishuAuthCapability({ channel }));
await controller.start();
```

## SDK 类型设计

新增文件：`packages/nextclaw-extension-sdk/src/services/extension-channel-controller.service.ts`

```ts
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type {
  ChannelSubmittedMessage,
  ExtensionChannel,
} from "./extension-sdk.types.js";

export type ExtensionChannelAdapter<TConfig, TInbound> = {
  configure: (config: TConfig) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onMessage: (handler: (message: TInbound) => void | Promise<void>) => () => void;
  sendNcpEvent: (event: NcpEndpointEvent) => Promise<void>;
  sendOutboundText?: (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }) => Promise<void>;
};

export type ChannelSubmittedMessageInput =
  Omit<ChannelSubmittedMessage, "channelId">;

export type ExtensionChannelInboundMapper<TInbound> =
  (message: TInbound) => ChannelSubmittedMessageInput | Promise<ChannelSubmittedMessageInput>;

export type ExtensionChannelControllerOptions<TConfig, TInbound> = {
  channel: ExtensionChannel;
  adapter: ExtensionChannelAdapter<TConfig, TInbound>;
  mapInbound: ExtensionChannelInboundMapper<TInbound>;
  onNcpEventError?: (error: unknown, event: NcpEndpointEvent) => void | Promise<void>;
};

export class ExtensionChannelController<TConfig, TInbound> {
  private readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly options: ExtensionChannelControllerOptions<TConfig, TInbound>,
  ) {}

  readonly start = async (): Promise<void> => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.options.adapter.onMessage(this.submitMessage));
    this.cleanups.push(this.options.channel.onNcpEvent(this.sendNcpEvent));
    this.cleanups.push(this.options.channel.config.onChange(async () => {
      await this.applyConfig();
    }));
    await this.applyConfig();
  };

  readonly stop = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.drainCleanups();
    await this.options.adapter.stop();
  };

  readonly sendOutboundText = async (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }): Promise<{ accepted: true }> => {
    if (!this.options.adapter.sendOutboundText) {
      throw new Error(`channel "${this.options.channel.id}" does not support outbound text`);
    }
    await this.options.adapter.sendOutboundText(params);
    return { accepted: true };
  };

  private readonly applyConfig = async (): Promise<void> => {
    const config = await this.options.channel.config.get<TConfig>();
    await this.options.adapter.configure(config);
    if (defaultChannelEnabled(config) === false) {
      await this.options.adapter.stop();
      return;
    }
    await this.options.adapter.start();
  };

  private readonly submitMessage = async (message: TInbound): Promise<void> => {
    await this.options.channel.submitMessage(await this.options.mapInbound(message));
  };

  private readonly sendNcpEvent = async (event: NcpEndpointEvent): Promise<void> => {
    try {
      await this.options.adapter.sendNcpEvent(event);
    } catch (error) {
      await this.options.onNcpEventError?.(error, event);
    }
  };

  private readonly drainCleanups = (): void => {
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
  };
}

function defaultChannelEnabled(config: unknown): boolean {
  return !(
    config &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    (config as { enabled?: unknown }).enabled === false
  );
}
```

修改：`packages/nextclaw-extension-sdk/src/index.ts`

```ts
export { ExtensionChannelController } from "./services/extension-channel-controller.service.js";
export type {
  ExtensionChannelAdapter,
  ChannelSubmittedMessageInput,
} from "./services/extension-channel-controller.service.js";
```

## Task 1: SDK controller contract tests

**Files:**

- Modify: `packages/nextclaw-extension-sdk/src/extension-sdk.test.ts`
- Create: `packages/nextclaw-extension-sdk/src/services/extension-channel-controller.service.ts`
- Modify: `packages/nextclaw-extension-sdk/src/index.ts`
- Modify: `packages/nextclaw-extension-sdk/src/module-structure.config.json`

**Steps:**

1. 在 SDK 测试中新增 fake adapter，覆盖 `start()` 注册 `onMessage`、`onNcpEvent`、`config.onChange`。
2. 测试 adapter message 会经 `mapInbound` 调用 `channel.submitMessage`。
3. 测试 `config.enabled === false` 时 controller 调 `adapter.stop()`，不再 `adapter.start()`。
4. 测试重复 `start()` 不重复订阅，重复 `stop()` 不重复 stop。
5. 测试 `sendOutboundText()` 在 adapter 支持时返回 `{ accepted: true }`。
6. 测试 adapter 不支持 outbound text 时抛明确错误。
7. 实现 `ExtensionChannelController` 和相关类型。
8. 导出新类型和 helper。
9. 更新 `module-structure.config.json`，允许新增 `services`、`types`、`utils` 文件已在白名单内，只需确认没有新增根目录。

**Commands:**

```bash
pnpm --filter @nextclaw/extension-sdk test -- --run
pnpm --filter @nextclaw/extension-sdk tsc
```

## Task 2: Weixin controller replacement

**Files:**

- Modify: `packages/extensions/nextclaw-channel-extension-weixin/src/main.ts`
- Create: `packages/extensions/nextclaw-channel-extension-weixin/src/utils/weixin-submitted-message.utils.ts`
- Delete: `packages/extensions/nextclaw-channel-extension-weixin/src/services/weixin-extension-runtime.service.ts`
- Modify: `packages/extensions/nextclaw-channel-extension-weixin/src/tests/weixin-extension-runtime.test.ts`
- Modify as needed: `packages/extensions/nextclaw-channel-extension-weixin/src/types/weixin-extension.types.ts`

**Mapper target:**

```ts
import type { ChannelSubmittedMessageInput } from "@nextclaw/extension-sdk";
import type { WeixinInboundMessage } from "../types/weixin-extension.types.js";

export function toWeixinSubmittedMessage(message: WeixinInboundMessage): ChannelSubmittedMessageInput {
  return {
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: {
      type: "text",
      text: message.text,
    },
    ...(message.attachments ? { attachments: message.attachments } : {}),
    metadata: {
      ...(message.accountId ? { accountId: message.accountId, account_id: message.accountId } : {}),
      ...(message.contextToken ? { context_token: message.contextToken } : {}),
      ...(message.raw === undefined ? {} : { raw: message.raw }),
    },
  };
}
```

**Steps:**

1. 新增 mapper 测试，断言 accountId/contextToken/attachments/raw 保持现有输出。
2. 修改 `main.ts` 使用 SDK `ExtensionChannelController`。
3. 保留 `channel.auth` capability 和 `channel.outbound.sendText` handler。
4. 删除 `WeixinExtensionRuntime` class。
5. 将原 runtime tests 改成 SDK controller tests + weixin mapper/main wiring 能覆盖的测试；不要为删除的 class 保留兼容入口。
6. 确认 `WeixinChannelAdapter` 合同满足 `ExtensionChannelAdapter<WeixinChannelConfig, WeixinInboundMessage>` 和 outbound text adapter。

**Commands:**

```bash
pnpm --filter @nextclaw/channel-extension-weixin test -- --run
pnpm --filter @nextclaw/channel-extension-weixin tsc
pnpm --filter @nextclaw/channel-extension-weixin lint
```

## Task 3: Feishu controller replacement

**Files:**

- Modify: `packages/extensions/nextclaw-channel-extension-feishu/src/main.ts`
- Create: `packages/extensions/nextclaw-channel-extension-feishu/src/utils/feishu-submitted-message.utils.ts`
- Delete: `packages/extensions/nextclaw-channel-extension-feishu/src/services/feishu-extension-runtime.service.ts`
- Modify: `packages/extensions/nextclaw-channel-extension-feishu/src/tests/feishu-extension-runtime.service.test.ts`
- Modify as needed: `packages/extensions/nextclaw-channel-extension-feishu/src/types/feishu-extension.types.ts`

**Mapper target:**

```ts
import type { ChannelSubmittedMessageInput } from "@nextclaw/extension-sdk";
import type { FeishuInboundMessage } from "../types/feishu-extension.types.js";

export function toFeishuSubmittedMessage(message: FeishuInboundMessage): ChannelSubmittedMessageInput {
  return {
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: {
      type: "text",
      text: message.text,
    },
    metadata: {
      accountId: message.accountId,
      account_id: message.accountId,
      peerId: message.conversationId,
      peer_id: message.conversationId,
      peerKind: message.peerKind,
      peer_kind: message.peerKind,
      ...(message.messageId ? { message_id: message.messageId } : {}),
      ...(message.raw === undefined ? {} : { raw: message.raw }),
    },
  };
}
```

**Steps:**

1. 新增 mapper 测试，断言 peer/account/messageId/raw metadata 保持现有输出。
2. 修改 `main.ts` 使用 SDK `ExtensionChannelController`。
3. 保留 `channel.auth` capability。
4. 删除 `FeishuExtensionRuntime` class。
5. 将原 runtime tests 改成 SDK controller tests + feishu mapper/main wiring 能覆盖的测试。
6. 确认 `FeishuChannelAdapter` 合同满足 `ExtensionChannelAdapter<FeishuChannelConfig, FeishuInboundMessage>`。

**Commands:**

```bash
pnpm --filter @nextclaw/channel-extension-feishu test -- --run
pnpm --filter @nextclaw/channel-extension-feishu tsc
pnpm --filter @nextclaw/channel-extension-feishu lint
```

## Task 4: Capability helper decision

**Files:**

- Modify: `packages/extensions/nextclaw-channel-extension-weixin/src/services/weixin-auth-capability.service.ts`
- Modify: `packages/extensions/nextclaw-channel-extension-feishu/src/services/feishu-auth-capability.service.ts`

**Steps:**

1. 不新增 SDK payload helper；`readRequiredString` / `readOptionalString` 这类极小解析留在调用现场，避免为了两行代码扩大 SDK public surface。
2. 如果 `readCurrentConfig` 仍重复但足够小，先保留在各 capability；不要为了两行代码新增过度抽象。
3. 只有当测试显示多个 capability 都需要 config record 读取时，再新增 `readChannelConfigRecord(channel)`。

**Commands:**

```bash
pnpm --filter @nextclaw/channel-extension-weixin test -- src/tests/weixin-auth-capability.service.test.ts --run
pnpm --filter @nextclaw/channel-extension-feishu test -- src/tests/feishu-auth-capability.service.test.ts --run
pnpm --filter @nextclaw/extension-sdk test -- --run
```

## Task 5: Full validation and maintainability close

**Commands:**

```bash
pnpm --filter @nextclaw/extension-sdk tsc
pnpm --filter @nextclaw/extension-sdk test -- --run
pnpm --filter @nextclaw/channel-extension-weixin tsc
pnpm --filter @nextclaw/channel-extension-weixin test -- --run
pnpm --filter @nextclaw/channel-extension-weixin lint
pnpm --filter @nextclaw/channel-extension-feishu tsc
pnpm --filter @nextclaw/channel-extension-feishu test -- --run
pnpm --filter @nextclaw/channel-extension-feishu lint
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
git diff --check
```

## Success Criteria

- 微信/飞书不再各自维护重复的 `*ExtensionRuntime`。
- SDK controller 覆盖通用 channel extension 生命周期：start/stop、cleanup、config onChange、enabled gate、message submit、NCP event forwarding、outbound text helper。
- 微信/飞书 mapper 明确保留原 metadata 合同。
- 渠道 adapter 仍保留全部渠道特有逻辑。
- 新增 framework 后，未来 channel 接入只需 adapter + mapper + optional auth/outbound handler + manifest。
- 本轮是非新增用户能力的架构收敛，最终非测试代码净增应尽量小；若净增为正，必须说明通用 SDK controller 能删除两套旧 extension runtime 的抵消关系和后续迁移收益。

## Follow-up After This Plan

完成本轮后，再单独设计“旧 `channel-plugin-*` 到新 `channel-extension-*` 的迁移模板”。迁移模板应以本轮 SDK controller 为唯一标准，不再复制旧 `@nextclaw/channel-runtime` 聚合模式。
