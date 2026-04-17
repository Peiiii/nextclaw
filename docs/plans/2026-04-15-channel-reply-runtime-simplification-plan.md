# Interaction Transport Simplification Plan

## 背景

这份计划文档虽然沿用了旧文件名，但当前内容已经更新为最新共识：

- 协议性的交互约束，优先通过 TypeScript 类型定义表达。
- 机制性实现不应继续堆在 `nextclaw` CLI 包里。
- `nextclaw` 负责应用装配与运行入口，不负责定义通用交互协议。
- 交互出站的共享语义，应建立在 NCP event stream 之上，而不是建立在“最终字符串”或私有 control message 之上。

当前用户关心的问题并不是“微信怎么快发”这么窄，而是更底层的一件事：

**我们是否已经把“任意输入驱动 Agent，任意输出面消费交互结果”收敛成一种简洁、稳定、可复用的交互抽象。**

本轮结论是：应该。

而且这个抽象不应该先从微信、Telegram、Feishu 这些具体渠道反推出来，也不应该先从 `runtime`、`reply` 这种局部实现词开始命名，而应该先把更稳定的交互协议定义好，再让具体应用层去消费它。

## 长期目标对齐 / 可维护性推进

这次收敛方向与 NextClaw 的长期目标一致：

- 它强化的是“统一入口下的能力编排”，不是某个单渠道的局部技巧。
- 它强化的是“统一交互协议 + 多输出面消费”，不是继续让每个渠道各自发明一套 reply 机制。
- 它减少的是产品底座的连接数和概念数，让更多能力可以通过同一条交互主链被承接。

可维护性上的核心判断也很明确：

- 真相源更少比局部兼容更重要。
- 单主链比“先兼容几种旧写法”更重要。
- 共享投影层比“每个渠道自己理解事件”更重要。
- 把机制沉到通用包里，比继续往 `nextclaw` CLI 包里塞东西更重要。

## 当前落地状态

本轮已经完成的部分：

### 1. 协议真相源已经下沉到 `@nextclaw/ncp-toolkit`

真相源文件：

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/interaction/interaction.types.ts`

当前已经稳定下来的协议类型：

- `InteractionEndpoint`
- `InteractionCapability`
- `InteractionSurfaceProfile`
- `NcpInteractionProjectionInput`
- `OutboundInteractionAction`
- `OutboundInteractionDeliveryPort`
- `OutboundInteractionDeliveryPortResolver`

这些类型表达的是更本质的交互层约束，而不是某个具体渠道的局部接口。

### 2. 通用实现已经跟着协议一起搬到 `@nextclaw/ncp-toolkit`

共享实现文件：

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/interaction/interaction-projector.service.ts`
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/interaction/outbound-interaction-orchestrator.service.ts`

当前职责已经收敛为两层：

- `NcpInteractionProjectorService`
  - 唯一负责把 NCP 事件流投影成交互动作。
- `OutboundInteractionOrchestratorService`
  - 唯一负责顺序驱动交互动作的实际投递。

### 3. `nextclaw` 里只保留应用侧 runner / wiring 过渡壳

当前仍保留在 `nextclaw` 的核心过渡实现：

- `packages/nextclaw/src/cli/commands/ncp/runtime/runner/nextclaw-ncp-runner.service.ts`

它的定位不是定义协议，而是：

- 提供 `AsyncIterable<NcpEndpointEvent>` 流式入口
- 为 `nextclaw` 应用层保留 NCP 运行入口
- 给后续 gateway / plugin / channel cutover 提供桥接点

这层仍然是过渡壳，但它已经不再试图拥有交互协议本身。

## 目标架构

### L0：Interaction Ingress / Egress

这层只负责对接真实世界的输入面和输出面，例如：

- 微信
- Telegram
- Feishu
- Web UI
- webhook / API / future adapters

它只关心：

- 如何收到输入
- 如何把输入映射到应用入口
- 如何把交互动作投递到具体表面

它不负责解释 NCP 事件语义。

### L1：NCP Event Stream

这层只提供一件事：

- `AsyncIterable<NcpEndpointEvent>`

它是交互主链的唯一上游真相源。

禁止继续把这层压扁成：

- `Promise<string>`
- “最后一条 completed message”
- 私有 `assistant_stream delta/reset` 控制消息

### L2：Shared Interaction Projection

这层只回答一个问题：

**原始 NCP 事件在交互层应该被解释成什么动作。**

当前输出动作已经收敛为：

- `typing-start`
- `message-block`
- `message-final`
- `typing-stop`
- `delivery-error`

这层只解释语义，不做实际发送。

### L3：Outbound Interaction Orchestration

这层只回答一个问题：

**这些交互动作应该按什么顺序、通过哪个输出端口、以什么最小状态被送出去。**

它负责：

- 解析 `OutboundInteractionDeliveryPort`
- 串行驱动动作
- 幂等处理 `typing-stop`
- 统一收尾与失败处理

它不判断文本块边界，也不关心某个渠道的具体消息结构。

### L4：Surface Delivery Port

这层只负责：

- `startTyping`
- `deliverBlock`
- `deliverFinal`
- `deliverError`
- `stopTyping`

它是一个纯输出面 port。

它不该直接消费原始 NCP 事件，也不该自行推导 reply lifecycle。

## 包边界与职责定位

### `@nextclaw/ncp`

职责：

- 定义底层 NCP 协议与事件模型

不负责：

- 渠道交互语义
- 应用层渠道发送策略

### `@nextclaw/ncp-toolkit`

职责：

- 承载建立在 NCP 之上的共享交互协议
- 承载共享语义投影实现
- 承载共享出站编排实现

这是当前这套机制最合理的归宿，因为它既不属于纯底层协议，也不应该被绑死在 `nextclaw` CLI 应用里。

### `nextclaw`

职责：

- 应用入口
- runner / gateway / plugin wiring
- surface-specific port 装配

不负责：

- 再定义一套平行交互协议
- 再拥有一套局部 reply runtime 内核

## TS 协议真相源

当前这套设计最重要的约束不是类名，而是类型边界。

第一真相源：

- `packages/ncp-packages/nextclaw-ncp-toolkit/src/interaction/interaction.types.ts`

第二真相源：

- `packages/nextclaw/src/cli/commands/ncp/runtime/runner/nextclaw-ncp-runner.service.ts`

这两个文件共同定义了当前批次最小但足够稳定的主合同：

1. 上游必须能提供原始 NCP event stream。
2. 中间层必须把 event stream 投影成交互动作。
3. 下游必须通过统一 delivery port 消费这些动作。

除此之外，不再引入额外“隐藏协议”。

## 单主链原则

这次方案必须死守一条主链：

`NCP event stream -> interaction projector -> outbound orchestrator -> delivery port`

允许存在的实现差异只有输出面差异，不允许存在协议差异。

必须禁止的结构：

- `Promise<string>` 和 event stream 同时作为 live 主输入
- old outbound bus 和 new orchestrator 长期双轨
- channel adapter 自己再解释一遍 NCP event
- gateway / plugin bridge 继续私有发明 reply 生命周期

如果某个能力未来要接入任何新系统，也必须先接到这条主链上，而不是另外长一套。

## 最小合同草案

下面这组类型不是“想象中的未来接口”，而是当前已经落地或应继续稳定下来的合同方向：

```ts
type InteractionEndpoint = {
  surfaceType: string;
  surfaceInstanceId: string;
  conversationId: string;
  participantId: string;
  messageId?: string;
};

type OutboundInteractionAction =
  | { type: "typing-start" }
  | { type: "message-block"; blockId: string; text: string }
  | { type: "message-final"; text: string }
  | { type: "typing-stop" }
  | { type: "delivery-error"; message: string };

interface OutboundInteractionDeliveryPort {
  startTyping(endpoint: InteractionEndpoint): Promise<void>;
  deliverBlock(
    endpoint: InteractionEndpoint,
    blockId: string,
    text: string,
  ): Promise<void>;
  deliverFinal(endpoint: InteractionEndpoint, text: string): Promise<void>;
  deliverError(endpoint: InteractionEndpoint, message: string): Promise<void>;
  stopTyping(endpoint: InteractionEndpoint): Promise<void>;
}
```

这组合同的重点不在字段名，而在职责切分：

- endpoint 只描述交互发生在哪个表面
- action 只描述交互层发生了什么
- delivery port 只描述如何把动作送到该表面

## 为什么这比旧的 `channel-reply` 骨架更好

旧骨架的问题不是“不能工作”，而是 scope 太局部：

- 命名被 `channel / reply / runtime` 锁死
- 看起来像 CLI 包里的一个子功能，而不是共享交互机制
- 容易让人继续往 `nextclaw` 应用层里堆机制

新的结构更干净，因为它把三个层次分开了：

1. `@nextclaw/ncp`
   - 只讲底层事件
2. `@nextclaw/ncp-toolkit`
   - 只讲共享交互协议与共享实现
3. `nextclaw`
   - 只讲应用装配和具体输出面接线

这样未来即使接入新的 surface，也是在复用同一套 contract，而不是复制一套“某渠道 reply runtime”。

## 剩余实施计划

### Step A：已完成

- 把协议真相源下沉到 `@nextclaw/ncp-toolkit`
- 把 projector / orchestrator 搬到 `@nextclaw/ncp-toolkit`
- 删除 `nextclaw` 内原来的 `channel-reply` 本地实现
- 在 `nextclaw` 中保留 runner 过渡壳

### Step B：下一步单批次切主链

目标：

- gateway / plugin bridge / channel surface 全部改为消费新的 interaction 主链
- 旧 outbound bus / control message / final-string bridge 同批次失去主职责

涉及的重点文件会集中在：

- `packages/nextclaw/src/cli/commands/service-support/gateway/*`
- `packages/nextclaw/src/cli/commands/service-support/plugin/*`
- 各 surface-specific delivery port 适配层

硬要求：

- 不做长期双轨
- 不按渠道做长期新旧混跑
- 不再新增旧 reply 主链调用点

### Step C：清残留

目标：

- 删除已经退场的旧 reply 旁路
- 统一命名
- 搜索并清除所有已经失效的旧路径和旧概念

这一步不单独创造新能力，只负责把结构彻底收干净。

## 代码护栏

为了保证这套设计不是“纸面优雅、实现又长回去”，后续实现必须遵守下面这些护栏。

### 1. 协议只能定义一次

凡是交互层协议字段、动作类型、delivery port 能力，统一只在 `interaction.types.ts` 定义。

禁止：

- gateway 自己再定义一套 action type
- channel package 自己复制 endpoint shape
- plugin bridge 再造一个“几乎一样”的 reply contract

### 2. 共享语义只能解释一次

凡是“什么时候 flush block、什么时候 final、什么时候 stop typing”这类问题，统一只在 `NcpInteractionProjectorService` 回答。

禁止：

- 微信 adapter 自己看 NCP event
- Telegram adapter 自己推断 completed
- bridge 再写一套文本块分段逻辑

### 3. 出站编排只能拥有一次

凡是交互动作顺序、幂等 stop、失败收尾、block 去重，统一只在 `OutboundInteractionOrchestratorService` 拥有。

禁止：

- gateway 夹带一层发送状态机
- adapter 自己兜生命周期
- plugin bridge 平行维护第二套 orchestrator

### 4. `nextclaw` 只负责装配

`nextclaw` 可以有 wiring，可以有 runner，可以有 surface-specific port 解析，但不再拥有共享交互机制本身。

如果未来再出现“这机制是不是也顺手放到 CLI 包里”，默认答案应当是：

**不放，先判断它是不是共享 contract 或共享机制；如果是，就优先考虑 `@nextclaw/ncp-toolkit`。**

## 验收标准

这次设计是否真正成立，看下面几条是否同时满足：

1. 交互协议真相源是否已经明确落在 `interaction.types.ts`。
2. projector 与 orchestrator 是否已经从 `nextclaw` 移出，并进入共享包。
3. `nextclaw` 是否只剩 runner / wiring / 过渡壳，而不是继续定义机制。
4. 新 surface 若要接入，是否只需要实现 delivery port，而不需要再发明一套 reply 协议。
5. 后续 cutover 是否可以沿着单主链推进，而不是再次长出双轨。

## 当前验证基线

本轮已经验证通过的命令基线应维持为：

```bash
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- src/interaction/interaction-projector.service.test.ts src/interaction/outbound-interaction-orchestrator.service.test.ts
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/runtime/nextclaw-ncp-runner.test.ts
PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH pnpm -C packages/nextclaw tsc
```

## 结论

当前这套设计已经从“局部渠道 reply 骨架”向“共享交互协议 + 共享交互编排”迈出了一步，但还没有完成 live 主链切换。

这一步最关键的价值不只是代码搬家，而是边界被摆正了：

- 机制在共享包
- 协议由 TS 类型锁住
- 应用层退回装配层

剩下的工作，不是再发明更多概念，而是沿着这条更干净的主链把旧链路切掉。
