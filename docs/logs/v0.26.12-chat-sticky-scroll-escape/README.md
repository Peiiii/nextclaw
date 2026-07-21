# v0.26.12 会话流式贴底逃逸修复

## 迭代完成说明

- 根因：消息增长触发的 `ResizeObserver` 已经排入一次贴底 `requestAnimationFrame` 后，用户即使主动向上滚动并越过贴底阈值，这个待执行任务仍会在下一帧把视口拉回底部；随后产生的滚动事件又会把 sticky 状态重新开启。
- 复现确认：修复前的定向回归测试中，用户将 `scrollTop` 从底部向上移动到距底 11px 的 `889` 后，待执行帧仍会把它改回 `1000`。
- 修复方式：在共享 owner `useStickyBottomScroll` 中，当用户越过阈值时同步取消待执行贴底任务，并复用同一取消逻辑处理任务替换与组件卸载；同时删除调用方外层的重复空值判断。
- 修复命中根因：退出 sticky 不再只是修改布尔状态，而是同时撤销已经产生、尚未执行的浏览器滚动副作用，因此流式内容继续增长也无法用旧任务重新夺回视口。

## 测试/验证/验收方式

- 定向回归测试：`pnpm --dir packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/hooks/use-sticky-bottom-scroll.test.tsx`，5/5 通过，覆盖距底 11px 时取消已排队贴底任务。
- 类型检查：`pnpm --dir packages/nextclaw-agent-chat-ui run tsc` 通过。
- 静态检查：`pnpm --dir packages/nextclaw-agent-chat-ui run lint` 通过。
- 构建：`pnpm --dir packages/nextclaw-agent-chat-ui run build` 通过，仅有既有 Node 弃用提示。
- 包级完整测试：234 项中 231 项通过；其余 3 项分别为公共合同 ReactNode、文件操作空白样式和 jsdom `Selection.modify` 的既有无关失败，相关测试文件均不在本次 diff 中。
- 当前源码真实浏览器验收：使用隔离的 `local:source-runtime` 实例和真实浏览器 `ResizeObserver` / `requestAnimationFrame` / 滚动事件链路。流式增长中向上滚动后，距底从 184px 增至 1576px，`scrollTop` 保持 `1544`，sticky 持续为关闭，证明后续流式内容没有重新夺回视口。
- 治理检查：maintainability guard、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 均通过。

## 发布/部署方式

- 已新增 `.changeset/fix-chat-sticky-scroll-escape.md`，为 `@nextclaw/agent-chat-ui` 与其产品消费包 `@nextclaw/ui` 声明 patch 版本。
- 本轮未执行 NPM 发布、线上部署、宿主重启、Git 提交或推送；真实验收使用隔离的当前源码实例完成，未影响用户现有运行实例。

## 用户/产品视角的验收步骤

1. 在会话底部等待助手开始流式回复，确认新内容正常自动贴底。
2. 在回复仍持续输出时主动向上滚动超过 10px，确认视口立即退出自动贴底，并出现可用的回到底部操作。
3. 保持当前位置等待更多内容继续输出，确认视口不会再次被自动拉到底部。

## 可维护性总结汇总

- 生产代码统计：新增 21 行、删除 26 行，净减少 5 行；测试新增 41 行，总 diff 为新增 62 行、删除 26 行。
- 正向减债：把排队任务替换、用户逃逸与卸载清理统一到单一取消入口，删除重复空值守卫，没有新增生产文件、类型或平行滚动通道。
- 生命周期复核：组件类型、key 与父级结构未改变；本次问题属于浏览器滚动副作用生命周期缺口，修复收敛在共享滚动 owner 内。
- maintainability guard 为 0 error、0 warning；主观复核未发现新增 owner、抽象或目录债务。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch 发布，本轮未发布，等待统一发布流程。
- `@nextclaw/ui`：作为用户产品消费包需要同步 patch 发布，本轮未发布，等待统一发布流程。
