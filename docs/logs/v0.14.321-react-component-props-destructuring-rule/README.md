# v0.14.321-react-component-props-destructuring-rule

## 迭代完成说明

- 在根 ESLint 配置中新增仓库级自定义规则，约束 React 组件不要在组件体内持续读取 `props.xxx`，而是优先在参数边界完成 props 解构。
- 规则只针对高置信度组件场景生效：PascalCase 组件名、函数体内存在 JSX、且首个参数仍是未解构的 `props` 标识符。
- 将该规则接入 `packages/nextclaw-ui` 与 `packages/nextclaw-agent-chat-ui` 的 UI lint 配置，当前先以 `warn` 形式落地，避免一次性打爆历史债务。
- 同步把 [chat-reasoning-block.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-reasoning-block.tsx) 改成参数解构写法，作为首个落地点。

## 测试/验证/验收方式

- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/eslint-rules/react-component-props-destructuring-rule.test.mjs`
- 运行：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm exec eslint packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-reasoning-block.tsx`
- 验证点：
  - JSX 组件若使用 `props.xxx`，会收到新的 lint 提示。
  - 已在参数边界解构 props 的组件不会触发该规则。
  - 普通非组件 helper 函数不会被误报。

## 发布/部署方式

- 本次变更为仓库治理规则与 UI 代码风格收敛，无独立部署动作。
- 合并后，相关 UI 包执行 `eslint` 时会自动带上该规则。
- 后续若历史债务逐步清完，可再把该规则从 `warn` 升为 `error`。

## 用户/产品视角的验收步骤

1. 在任一 React 组件中写出 `function Demo(props) { return <div>{props.label}</div>; }` 这样的模式。
2. 运行对应包的 `eslint`。
3. 确认会收到“应在参数边界解构 props”的告警。
4. 改成 `function Demo({ label }) { ... }` 后再次运行，确认告警消失。
