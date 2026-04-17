# Gateway Manual Restart Contract Alignment Design

日期：2026-04-17

相关文档：

- [NextClaw 产品愿景](../VISION.md)
- [v0.16.47-manual-restart-required-state](../logs/v0.16.47-manual-restart-required-state/README.md)
- [Predictable Behavior First](../../.agents/skills/predictable-behavior-first/SKILL.md)

若现状代码与本文冲突，以本文作为后续这一轮集中改造的目标契约。

## 1. 背景

前一轮我们已经把“配置变更不应自动重启，而应进入待重启状态，由用户自己决定何时重启”这件事，做成了明确的产品方向：

- Runtime 页面能看到 `pendingRestart`
- 左上角版本号右侧的小圆点能提示“待重启”
- 用户可以从轻量浮层里看到原因，并主动点击重启
- 真正完成重启后，待重启状态应自动清空

这个方向本身是对的，也更符合 `NextClaw` 想成为“统一入口、统一体验、可理解、可掌控的个人操作层”的长期愿景。

但用户随后用真实链路验证时发现：

- 通过 AI / gateway 工具执行 `config.get -> config.patch`
- 系统仍然会直接自动重启
- 日志里仍然会出现 `Restart scheduled`

这说明我们上一轮只完成了“部分入口”的行为收敛，还没有把“配置变更后的重启语义”做成全系统统一合同。

这份文档的目标，就是把这个问题一次性讲清楚，并收敛成后续可直接实施的改造方案。

## 2. 问题定义

本次要解决的不是单一 bug，而是一个跨入口的行为合同不一致问题。

当前系统里，至少同时存在两种配置变更后的语义：

1. `UI / runtime control / live reload` 链路
   - 倾向于进入 `pendingRestart`
   - 由用户看到提示后自行决定是否重启

2. `gateway config.apply / config.patch` 链路
   - 保存配置后直接触发 `requestRestart`
   - 返回值仍宣称 `restart.scheduled = true`
   - 日志和系统消息仍宣称 `Restart scheduled`

这会带来三个直接问题：

- 用户无法预测“同样是改配置，为什么有时只是待重启，有时却直接把系统重启了”
- AI / gateway 工具的返回合同在对外撒谎，声称已经安排重启，而不是诚实表达“配置已保存，等待用户手动重启”
- UI、CLI、gateway 三个入口对同一件事给出不同语义，破坏产品的一致性和可学习性

## 3. 上位目标对齐

这次改造必须服务以下长期目标，而不是只修一条调用链：

- 让 `NextClaw` 的系统管理行为更可理解、更可预测
- 让“用户通过自然语言和统一控制面掌控系统”成为真实能力，而不是不同入口各说各话
- 让状态系统成为统一入口，而不是让用户依赖日志、运气或隐含经验
- 让配置写入和重启执行成为两种明确分离的动作

换句话说：

**配置写入是“保存意图”，重启是“执行动作”。**

它们可以有关联，但不能再被隐藏地绑成同一件事。

## 4. 现状根因

### 4.1 已有机制本身没有问题

当前 `RuntimeRestartRequestService` 已经支持两种明确模式：

- `mode: "notify"`：
  - 仅登记 `pendingRestart`
  - 不触发真实重启
- 默认执行模式：
  - 走 `RestartCoordinator`
  - 触发后台服务重启或进程退出

因此，底层能力并不是没有，而是入口没有统一接到同一个合同上。

### 4.2 真正绕过新合同的是 gateway 配置写入链路

当前真实问题点有两处：

1. `packages/nextclaw/src/cli/gateway/controller.ts`
   - `applyConfig()` 和 `patchConfig()` 在保存配置后，仍然直接调用 `this.requestRestart(...)`
   - 返回体仍写死为 `restart: { scheduled: true, delayMs }`

2. `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
   - 这里给 `GatewayControllerImpl` 注入的 `requestRestart(...)`，仍然是“执行重启”的语义
   - 它只传了 `manualMessage`
   - 但没有传 `mode: "notify"`

因此这不是 UI 漏提示，也不是状态不同步，而是：

**gateway 配置写入链路压根没有切到新的“待重启”合同。**

### 4.3 合同文案也在继续误导调用方

除了真实行为没改干净，当前外部合同也仍然在强化错误预期：

- gateway tool description 还写着 `trigger restart`
- `config.apply` / `config.patch` 返回里还在说 `restart.scheduled`
- `restart()` 的默认返回文案仍是 `Restart scheduled`
- 相关测试、toast 和消息文案也默认沿用“已安排重启”的语义

这意味着即使只把行为改掉，不同步改合同，也会继续制造误导。

## 5. 设计原则

### 5.1 一个配置语义，只能有一个后置合同

对“配置写入成功，但需要重启后才生效”这类场景，整个系统必须只有一个统一合同：

- 配置已经保存
- 系统不会自动重启
- 系统会登记待重启状态
- 用户可以在统一状态入口看到原因
- 用户手动触发重启后，状态清空

禁止某些入口偷偷自动重启，某些入口只是挂状态。

### 5.2 观察和执行必须分离

依据 `predictable-behavior-first`：

- `config.get` 是 observation
- `config.apply` / `config.patch` 是 config mutation
- `restart` 是 execution

`config.apply` / `config.patch` 允许写配置并附带“需要重启”的状态信号，但不允许再隐藏地替用户执行重启动作。

### 5.3 状态入口统一，执行入口显式

“需要重启”这件事的默认可见入口，仍然应挂在左上角版本号右侧的小圆点上。

原因：

- 它足够轻量，不会破坏主界面简洁度
- 它足够靠近全局状态语义，不会变成某个页面私有提示
- 它能同时承接以后更多系统状态，而不只是一条重启提示

### 5.4 不再用模糊命名混淆“待重启”和“执行重启”

后续实现中，涉及配置写入后的动作，不应继续沿用语义模糊的 `requestRestart(...)` 去表示两件不同事情。

推荐收敛为两个显式动作：

- `requestRestart(...)`
  - 真正执行重启
- `notifyPendingRestart(...)`
  - 仅登记待重启

如果暂时不拆函数名，至少也必须让调用点显式传出 `mode: "notify"`，并在代码结构上清楚表明它不是执行重启。

## 6. 方案结论

### 6.1 配置写入成功后的标准行为

后续统一合同如下：

1. `config.apply` / `config.patch` 完成配置校验与保存
2. 判断该变更是否需要重启后才能生效
3. 若不需要重启：
   - 直接返回保存成功
   - 不登记 `pendingRestart`
4. 若需要重启：
   - 登记 `pendingRestart`
   - 返回“配置已保存，等待手动重启生效”
   - 不触发自动重启
5. 用户在状态圆点或 Runtime 页面中显式点击重启
6. 系统执行重启
7. 真正完成重启流程后清空 `pendingRestart`

### 6.2 本轮集中改造的推荐范围

本轮推荐只收口“配置写入相关语义”，不顺手扩大到所有会重启的动作。

也就是说：

- `config.apply`
- `config.patch`
- 现有 Runtime 页面里和配置改动相关的 `restartRequired`

这些必须统一到“待重启”合同。

而下面这些动作暂时不在同一轮强行混改：

- `update.run`
- 用户主动点击 `restart`
- 其它可能天然属于执行语义的系统动作

原因很简单：

- 用户当前明确关注的是“修改配置不应自动重启”
- `update.run` 更接近“更新流程如何切版本”的独立产品问题
- 强行同轮混改会把范围扩大，增加审核和验证复杂度

### 6.3 GatewayController 的目标形态

`GatewayControllerImpl` 后续应把“配置保存”和“重启处理”拆成两段显式逻辑：

1. 配置保存段
   - 负责读取快照
   - 负责 hash 校验
   - 负责 JSON 解析和 schema 校验
   - 负责落盘保存

2. 配置后置处理段
   - 负责判断是否需要重启
   - 若需要，登记 `pendingRestart`
   - 若不需要，返回普通成功结果

禁止在 `applyConfig()` / `patchConfig()` 成功保存后，直接无条件调用真实重启执行器。

### 6.4 Service Gateway Context 的目标形态

`service-gateway-context.ts` 里给 `GatewayControllerImpl` 注入的能力，应该明确分成两类：

- 配置写入后的待重启登记能力
- 用户显式点击后的真实重启执行能力

不要再让一个注入函数既能代表“待重启通知”，又能代表“马上重启”，否则调用点很难一眼看出真实语义。

### 6.5 外部返回合同的目标形态

当前这种返回体：

```json
{
  "ok": true,
  "restart": {
    "scheduled": true,
    "delayMs": 0
  }
}
```

不再符合真实产品语义，应该被替换。

推荐改成两类更诚实的合同之一：

方案 A，直接引入 `pendingRestart`：

```json
{
  "ok": true,
  "path": "...",
  "config": {},
  "pendingRestart": {
    "required": true,
    "automatic": false,
    "message": "Config saved. Restart manually to apply changes."
  }
}
```

方案 B，保留 `restart` 字段但改语义：

```json
{
  "ok": true,
  "path": "...",
  "config": {},
  "restart": {
    "required": true,
    "pending": true,
    "automatic": false
  }
}
```

本轮推荐方案 A。

原因：

- `pendingRestart` 直接和现有 UI/runtime contract 对齐
- 不会继续复用历史上已被污染的 `restart.scheduled` 心智
- 调用方一眼就知道“这里不是已经开始重启，而是进入待重启状态”

### 6.6 文案和描述的统一要求

后续所有相关描述都应统一成以下语义：

- 配置已保存
- 如需重启生效，系统会登记待重启
- 你可以在状态入口看到原因
- 系统不会自动重启

禁止继续使用以下模糊或错误说法：

- `Restart scheduled`
- `trigger restart`
- `restart after apply/patch`

除非它描述的真的是用户主动点击后的真实重启动作。

## 7. 关键设计细节

### 7.1 是否需要做“配置路径级别”的重启判定

需要，但不建议在 gateway controller 自己重新发明一套路径判定逻辑。

最佳做法是：

- 继续复用已有 `ConfigReloader` / reload plan 对哪些改动可热应用、哪些改动需要重启的判断
- `gateway config.apply` / `config.patch` 只消费这个结果
- 不自己在 controller 里再维护第二份配置路径语义表

原因：

- 配置语义必须有一个单一真相来源
- 如果 gateway 自己做一套“哪些字段要重启”的硬编码，后面一定会和 UI/CLI/live reload 再次漂移

### 7.2 对纯热应用配置的行为

对于本来就支持热应用的配置路径：

- 不登记 `pendingRestart`
- 不要求用户重启
- 返回“配置已保存并生效”

这和“所有配置改动都进入待重启”不是一回事。

本轮真正要统一的是：

**凡是需要重启的配置，不得再自动重启。**

而不是把所有配置都粗暴改成“总是待重启”。

### 7.3 `pendingRestart` 是否继续用进程内 store

这一轮建议继续沿用现有 `PendingRestartStore` 的进程内语义，不新增持久化。

原因：

- 你的核心诉求是“不要自动重启，由用户决定是否重启”
- 重启后自动清空，本来就是想要的语义
- 这轮先把合同统一好，比把状态持久化到磁盘更重要

除非后续用户明确提出“重启前关闭页面、重开后仍要保留待重启提示”，否则本轮不建议扩 scope。

### 7.4 `restart()` 是否要继续返回 `Restart scheduled`

可以保留，但语义必须只属于显式执行动作。

也就是说：

- 用户主动点击 `立即重启`
- 或 AI 明确执行 `gateway restart`

这类动作返回 `Restart scheduled` 是可以接受的，因为它真的触发了重启。

但 `config.apply` / `config.patch` 不再允许沿用这套文案。

## 8. 涉及文件建议

本轮集中改造预计会触达以下文件。

### 8.1 核心实现

- `packages/nextclaw/src/cli/gateway/controller.ts`
  - 收敛 `config.apply` / `config.patch` 后置语义
  - 不再无条件调用真实重启
  - 调整返回合同

- `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`
  - 明确区分“待重启通知”和“真实重启执行”的注入能力

- `packages/nextclaw-core/src/agent/tools/gateway.ts`
  - 更新 tool description
  - 让 gateway tool 对外表达真实合同

### 8.2 相关类型与消息

- `packages/nextclaw-server/src/ui/runtime-control.types.ts`
- `packages/nextclaw-ui/src/api/runtime-control.types.ts`

这两处预计不一定要再大改结构，但需要检查是否要补充更清晰的 pending restart message / reason 表达。

### 8.3 UI 和状态入口

- `packages/nextclaw-ui/src/components/layout/runtime-status-entry.tsx`
- `packages/nextclaw-ui/src/components/config/runtime-control-card.tsx`

大概率不需要大改交互，但要确认它们能正确消费 gateway 链路写入后的 `pendingRestart` 状态，不再依赖旧文案假设。

### 8.4 文档

- `packages/nextclaw/resources/USAGE.md`
- `docs/logs/v0.16.47-manual-restart-required-state/README.md`

实现完成后需要同步把用户文档和迭代记录补齐到真实最终语义。

## 9. 测试与验证方案

### 9.1 单元 / 集成测试

至少需要新增或补强以下保护：

1. `gateway controller` 级别测试
   - `config.patch` 命中“需要重启”时：
     - 不调用真实重启执行
     - 会登记 `pendingRestart`
     - 返回 `pendingRestart` 合同
   - `config.patch` 命中“支持热应用”时：
     - 不调用真实重启执行
     - 不登记 `pendingRestart`

2. `service-gateway-context` 级别测试
   - 配置写入场景走 notify-only 语义
   - 用户显式 `restart` 场景走真实执行语义

3. UI 测试
   - 状态圆点能反映 gateway 配置写入后的 `pendingRestart`
   - 浮层文案仍保持“待重启 + 原因 + 立即重启”

### 9.2 定向真实验证

这部分是本轮必须做的，不允许只用单测替代。

真实验证步骤：

1. 运行 gateway
2. 执行 `config.get`
3. 选一个低风险配置做 `config.patch`
   - 推荐继续使用 `agents.context.bootstrap.perFileChars`
4. 观察以下结果：
   - 服务没有自动重启
   - 日志里不再出现误导性的 `Restart scheduled` 作为 apply/patch 结果
   - 左上角状态圆点出现待重启提示
   - 点开能看到原因
   - 用户可以手动点击重启
5. 完成手动重启后，确认待重启状态清空

### 9.3 受影响的最小验证命令

实现后建议至少执行：

```bash
pnpm -C packages/nextclaw exec vitest run <gateway-related-tests>
pnpm -C packages/nextclaw-ui exec vitest run src/components/layout/runtime-status-entry.test.tsx src/components/config/runtime-control-card.test.tsx
pnpm -C packages/nextclaw exec tsc -p tsconfig.json --noEmit
pnpm -C packages/nextclaw-ui exec tsc -p tsconfig.json --noEmit
pnpm lint:maintainability:guard
```

其中 gateway 相关测试文件名，以实现时新增或补齐的测试文件为准。

## 10. 风险与边界

### 10.1 最大风险：只改行为，不改合同

如果只把自动重启去掉，但返回体和文案还在说 `Restart scheduled`，那这轮改造仍然是不完整的。

这会让：

- 用户误判系统已经帮他重启了
- AI 继续基于错误合同给出后续动作
- 日志、测试和 UI 形成新的不一致

### 10.2 第二个风险：在 gateway 内部复制第二套“配置是否需要重启”判定逻辑

这会造成：

- UI 用一套
- CLI 用一套
- gateway 再用一套

后面一定再次漂移。

因此本轮必须坚持单一真相来源，不新增第二套路径语义表。

### 10.3 本轮不处理的事

为了控制范围，这一轮不默认处理：

- `update.run` 是否改为“更新完成后进入待重启”
- `pendingRestart` 是否持久化到磁盘
- 更大范围的 runtime status 体系重构
- 任何与本问题无关的 UI 视觉重做

这些都可以在后续单独讨论，但不应混入本轮。

## 11. 推荐落地顺序

### 第一步：统一后端合同

- 先收口 `gateway controller`
- 再收口 `service-gateway-context`
- 让 `config.apply` / `config.patch` 真正只返回“已保存 + 是否待重启”

### 第二步：统一对外描述

- 更新 tool description
- 更新返回体字段
- 更新消息文案

### 第三步：补保护测试

- controller 级别
- gateway context 级别
- UI 状态入口级别

### 第四步：做真实链路验证

- 用真实 `config.get -> config.patch` 重跑你这次的复现场景

### 第五步：补文档和迭代记录

- 更新 `USAGE.md`
- 更新 `v0.16.47-manual-restart-required-state/README.md`

## 12. 最终结论

这次问题的本质不是“某个地方忘了加提示”，而是：

**系统还没有把“配置写入”和“执行重启”彻底拆成两个统一、诚实、可预测的合同。**

最好的修法不是继续补一层特殊判断，也不是在 gateway 上再打补丁，而是把整个系统收敛到以下单一路径：

- 改配置
- 保存成功
- 若需要重启，则进入待重启
- 用户从统一状态入口看到原因
- 用户主动触发重启
- 重启完成后状态清空

只要我们把 `gateway config.apply` / `config.patch` 也收回这条主路径，这个问题才算真正被一次性做对。
