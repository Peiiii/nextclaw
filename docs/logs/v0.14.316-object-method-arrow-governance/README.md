# v0.14.316-object-method-arrow-governance

## 迭代完成说明

- 统一修正 `packages/nextclaw/src/cli/commands/service-ncp-session-realtime-bridge.ts` 中返回对象里的 method shorthand 写法，改为箭头函数属性写法。
- 新增 `scripts/lint-new-code-object-methods.mjs`，对新改动里的 object literal method shorthand 做增量治理检查，要求统一使用 `foo: () => {}` 而不是 `foo() {}`。
- 将该检查接入 `pnpm lint:new-code:governance`，与现有的 `class-methods-arrow` 一起执行。
- 采用增量治理而不是全仓 ESLint 强推，避免一次性炸掉历史代码，同时保证新代码风格不再继续漂移。

## 测试/验证/验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter nextclaw exec tsc -p tsconfig.json --noEmit`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:new-code:governance`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`

## 发布/部署方式

- 本次主要是代码风格治理与增量检查机制调整，不涉及独立运行时功能发布。
- 若与当前 NCP 会话状态修复一并发布，可随同服务端代码一起发布。

## 用户/产品视角的验收步骤

1. 查看新改代码，确认对象字面量中不再使用 `foo() {}` 形式的方法写法。
2. 本地运行 `pnpm lint:new-code:governance`，确认新规则被执行且当前改动通过。
3. 后续新提交若再引入 object method shorthand，确认治理检查会直接报错阻止进入主干。
