# Goal Progress

## 当前目标

- 把当前分散在 `nextclaw` 等包里的产品本体运行时编排职责，逐步收口到唯一的 `@nextclaw/kernel` 中，让 `kernel` 真正成为 NextClaw 作为 Agent OS 的唯一内核，而不改变现有功能行为

## 明确非目标

- 不重写 `NCP` 现有单 agent runtime
- 不重新发明 agent 内部 tool loop
- 不把讨论滑向新的无关抽象层

## 冻结边界 / 不变量

- 上面这句“当前目标”就是最高优先级真相源；任何下一步都只能服务这句话
- `@nextclaw/kernel` 是唯一 kernel
- `@nextclaw/runtime` 是官方运行时发行层，不是 kernel
- `nextclaw` 是产品入口，不是 kernel
- 当前讨论优先解决职责边界与依赖关系，不先写新实现
- 任何下一步如果不能直接服务 `2026-04-20-nextclaw-kernel-architecture.md`，就必须先停下回看本文件

## 已完成进展

- 已重新确认目标文档就是 `2026-04-20-nextclaw-kernel-architecture.md`
- 已识别刚才的偏航点是开始重造 agent runtime / tool loop
- 已新增目标锚机制，后续用这个文件防漂移
- 已把最短 3 阶段落地战略写回目标架构文档
- 已完成阶段 1 的第一步落地：`nextclaw` 现在会实例化 `NextclawKernel`，并把 `gateway/ui/start/restart/serve/stop` 这组六个运行控制入口先接入 `kernel.control`
- 已验证这一步没有改动 `RuntimeCommandService` 和 `NCP` 内部 runtime，真实启动链路仍然正常
- 已把这次非功能治理压成净收敛：`Non-test line changes = net -57`

## 当前下一步

- 继续阶段 1，但下一步只迁下一个最小的产品本体编排切片，不碰 agent 内部 loop

## 执行闸口

- 每次准备进入新话题、新抽象、新实现前，先问一句：`这一步是否直接推进 kernel 架构文档的目标？`
- 如果答案不是明确的“是”，就不继续推进，先回看本文件并重述目标
- 如果用户指出“偏了 / 别造轮子 / 不是这个目标”，立即回看本文件并清零后重启计数

## 锚点计数器

- 当前值：0/20
