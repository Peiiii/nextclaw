# v0.26.12 会话流式贴底逃逸修复

## 迭代完成说明

- 根因：消息增长触发的 `ResizeObserver` 已经排入一次贴底 `requestAnimationFrame` 后，用户即使主动向上滚动并越过贴底阈值，这个待执行任务仍会在下一帧把视口拉回底部；随后产生的滚动事件又会把 sticky 状态重新开启。
- 复现确认：修复前的定向回归测试中，用户将 `scrollTop` 从底部向上移动到距底 11px 的 `889` 后，待执行帧仍会把它改回 `1000`。
- 修复方式：在共享 owner `useStickyBottomScroll` 中，当用户越过阈值时同步取消待执行贴底任务，并复用同一取消逻辑处理任务替换与组件卸载；同时删除调用方外层的重复空值判断。
- 修复命中根因：退出 sticky 不再只是修改布尔状态，而是同时撤销已经产生、尚未执行的浏览器滚动副作用，因此流式内容继续增长也无法用旧任务重新夺回视口。
- 后续回归根因：动态高度虚拟列表后来把“行起点位于视口上方”都视为可补偿范围；长流式消息虽然仍与视口相交，但起点已经在视口上方，因此每次增高都会由 virtualizer 再写一次 `scrollTop`，绕过 sticky owner 已经关闭的贴底路径。
- 后续修复：虚拟列表只补偿整行已经完全离开视口上方的高度变化。当前流式行或首个可见行增高时不再改写滚动位置，已离开视口的历史行仍维持原有阅读锚点。

## 测试/验证/验收方式

- 定向回归测试：`pnpm --dir packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx`，5/5 通过，覆盖距底 11px 时取消已排队贴底任务。
- 类型检查：`pnpm --dir packages/nextclaw-agent-chat-ui run tsc` 通过。
- 静态检查：`pnpm --dir packages/nextclaw-agent-chat-ui run lint` 通过。
- 构建：`pnpm --dir packages/nextclaw-agent-chat-ui run build` 通过，仅有既有 Node 弃用提示。
- 包级完整测试：234 项中 231 项通过；其余 3 项分别为公共合同 ReactNode、文件操作空白样式和 jsdom `Selection.modify` 的既有无关失败，相关测试文件均不在本次 diff 中。
- 当前源码真实浏览器验收：使用隔离的 `local:source-runtime` 实例和真实浏览器 `ResizeObserver` / `requestAnimationFrame` / 滚动事件链路。流式增长中向上滚动后，距底从 184px 增至 1576px，`scrollTop` 保持 `1544`，sticky 持续为关闭，证明后续流式内容没有重新夺回视口。
- 后续回归测试：`pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/features/message/hooks/__tests__/use-chat-message-virtualizer.test.tsx`，7/7 通过；修前距底 11px、20px 时，活动行增高 100px 会把 `scrollTop` 同步增加 100px，修后滚动位置保持不变且距离分别增长到 111px、120px。
- 后续真实浏览器验收：当前源码 UI 代理到用户原始 `55667` 后端。20px 逃逸后流式内容继续增长 291px，回到底部按钮持续可见且距离仍为 20px；点击按钮恢复到 0，再上滚 11px 后按钮持续可见且距离保持 11px。
- 后续工程验证：`@nextclaw/ui` TypeScript 与完整 ESLint 通过；包级全量测试为 803/817 通过，14 个失败来自会话创建旧参数断言、Welcome 缺 QueryClient、工作区旧文案与旧 query key，均不在本次两个触达文件中。
- 治理检查：maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 均通过。

## 发布/部署方式

- 原始 changeset 已由统一 full public workspace patch 批次消费，修复随 `nextclaw@0.27.1`、`@nextclaw/agent-chat-ui@0.6.14` 与 `@nextclaw/ui@0.15.14` 发布。
- 后续回归新增 `.changeset/fix-chat-sticky-scroll-virtualizer.md`，为真正发生行为变化的 `@nextclaw/ui` 声明 patch 版本，等待新的稳定 patch 发布闭环。
- stable runtime channel、两个生产文档域与公开旧版升级链路均已完成验证，完整发布证据见 `docs/logs/v0.26.13-npm-patch-release/README.md`。
- 发布与验收均使用隔离环境，没有重启或修改用户现有运行实例。

## 用户/产品视角的验收步骤

1. 在会话底部等待助手开始流式回复，确认新内容正常自动贴底。
2. 在回复仍持续输出时主动向上滚动超过 10px，确认视口立即退出自动贴底，并出现可用的回到底部操作。
3. 保持当前位置等待更多内容继续输出，确认视口不会再次被自动拉到底部。
4. 点击回到底部操作恢复贴底，再分别向上滚动 11px 与 20px，确认流式消息继续增高时两档都不会被重新拉回底部。

## 可维护性总结汇总

- 生产代码统计：新增 21 行、删除 26 行，净减少 5 行；测试新增 41 行，总 diff 为新增 62 行、删除 26 行。
- 正向减债：把排队任务替换、用户逃逸与卸载清理统一到单一取消入口，删除重复空值守卫，没有新增生产文件、类型或平行滚动通道。
- 生命周期复核：组件类型、key 与父级结构未改变；本次问题属于浏览器滚动副作用生命周期缺口，修复收敛在共享滚动 owner 内。
- 后续回归修复的生产代码为 `+1 / -1 / net 0`，只把虚拟列表补偿边界从行起点改为行终点；没有新增状态、effect、文件、抽象或平行滚动通道。
- 后续定向 maintainability guard 为 `0 error / 0 warning`，总代码 `+50 / -42 / net +8`，排除测试后 `+1 / -1 / net 0`。正向减债动作是简化滚动职责边界：virtualizer 只维护已离开视口的历史锚点，sticky owner 继续决定当前可见流式内容是否跟随底部。
- maintainability guard 为 0 error、0 warning；主观复核未发现新增 owner、抽象或目录债务。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui@0.6.14`：已发布，`latest` 已验证。
- `@nextclaw/ui@0.15.14`：已发布，`latest` 已验证。
- `nextclaw@0.27.1`：已随 full public workspace patch batch 发布并完成公开安装与 stable runtime 更新验收。
- 后续回归修复只触达 `@nextclaw/ui`，已由 `.changeset/fix-chat-sticky-scroll-virtualizer.md` 记录，等待新的稳定 patch 发布闭环。
