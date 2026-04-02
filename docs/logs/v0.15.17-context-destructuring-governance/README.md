# v0.15.17-context-destructuring-governance

## 迭代完成说明

- 在 [`packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`](../../../packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts) 中，统一收敛了 `params` 风格上下文对象的重复读取：
  - `buildClaudeInputBuilder`
  - `resolveClaudeModel`
  - `resolveBaseQueryOptions`
  - `resolveClaudeWorkingDirectory`
  - `resolveConfiguredClaudeModels`
  - `intersectSdkModelsWithConfiguredModels`
  - `resolveRecommendedClaudeModel`
  - `resolveClaudeRuntimeContext`
- 对上述函数改为优先解构顶层上下文，减少 `params.config`、`params.pluginConfig`、`params.sessionMetadata` 一类重复访问，让函数体的关注点回到业务判断本身。
- 同步删掉了 [`resolveConfiguredClaudeModels`](../../../packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts) 中未实际使用的 `pluginConfig` 参数，避免保留无效耦合。
- 在 [`scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs`](../../../scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs) 新增仓库自定义 ESLint 规则：
  - 只针对 `params` / `options` / `context` 这类上下文参数对象
  - 只在同一函数里重复读取达到阈值时提示
  - 不做“一刀切要求所有对象参数都解构”
- 在 [`eslint.config.mjs`](../../../eslint.config.mjs) 接入 `nextclaw/prefer-top-level-context-destructuring`，默认以 `warn` 级别治理，避免把仓库推进到过度解构。
- 在 [`scripts/eslint-rules/prefer-top-level-context-destructuring-rule.test.mjs`](../../../scripts/eslint-rules/prefer-top-level-context-destructuring-rule.test.mjs) 补了规则测试，覆盖：
  - 命中重复读取
  - 已做顶层解构
  - 低于阈值
  - `options/context` 命名
  - 非目标参数名

## 测试/验证/验收方式

- 规则测试：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH node --test scripts/eslint-rules/prefer-top-level-context-destructuring-rule.test.mjs`
- 定向 lint：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH pnpm eslint eslint.config.mjs scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs scripts/eslint-rules/prefer-top-level-context-destructuring-rule.test.mjs packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH pnpm eslint packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`
- 受影响包类型检查：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 受影响包构建：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
- 可维护性守卫：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths eslint.config.mjs scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs scripts/eslint-rules/prefer-top-level-context-destructuring-rule.test.mjs packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`
- 验证结果：
  - 新规则测试通过
  - 定向 lint 通过
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk` 的 `tsc` 通过
  - `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk` 的 `build` 通过
  - `post-edit-maintainability-guard` 输出 `Errors: 0`、`Warnings: 0`

## 发布/部署方式

- 本次改动属于仓库代码质量治理与运行时上下文整理，无独立 migration、服务部署或前端发布动作。
- 合入后，新 lint 规则会随仓库现有 ESLint 配置生效；后续开发在命中阈值时会收到提示。

## 用户/产品视角的验收步骤

1. 打开 [`packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts`](../../../packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk/src/claude-runtime-context.ts)，确认相关 helper 与 `resolveClaudeRuntimeContext` 已优先使用顶层解构变量，而不是在函数体里反复读 `params.xxx`。
2. 打开 [`scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs`](../../../scripts/eslint-rules/prefer-top-level-context-destructuring-rule.mjs)，确认规则只治理 `params/options/context` 类上下文对象，并且带阈值，不是全仓库强制所有对象参数都解构。
3. 打开 [`eslint.config.mjs`](../../../eslint.config.mjs)，确认 `nextclaw/prefer-top-level-context-destructuring` 已接入 TypeScript 基线配置，当前级别为 `warn`。
4. 运行本次迭代 README 中的规则测试与定向 lint 命令，确认规则行为与目标文件状态一致。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是
- no maintainability findings
- 可维护性总结：这次改动让目标运行时文件中“上下文参数反复读取”的噪音显著下降，同时把治理补成了可持续执行的 lint 规则，而不是只做一次人工修补。新增代码属于非功能改动下的最小必要增长，主要用于沉淀规则与测试；未保留新的平行实现、兜底分支或额外抽象层。
- 本次是否已尽最大努力优化可维护性：是。实现层面不只修了用户指出的片段，还把同文件内同类写法一起收敛；治理层面没有选择“一刀切强制所有对象参数都解构”，而是采用阈值型、窄范围的规则，兼顾约束力与可用性。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。目标文件通过顶层解构和删除未使用参数来减噪、减耦合；规则层面复用现有 ESLint 插件入口，没有再新增第二套平行治理机制。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：目标运行时文件的冗余读取和无效参数下降；仓库层面新增了 2 个规则文件，这是为把人工判断固化成机器可验证约束的最小必要增长，并同步偿还了“同类问题只能靠 code review 口头提醒”的维护性债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。此次没有引入新的运行时抽象，只是把“上下文对象的读取边界”前移到函数开头，并把规则沉淀在已有 `nextclaw` ESLint 插件位点，避免补丁式散落。
- 目录结构与文件组织是否满足当前项目治理要求：满足。运行时代码继续留在原插件目录，lint 规则与测试都落在现有 [`scripts/eslint-rules/`](../../../scripts/eslint-rules/) 下，没有引入新的平铺目录或职责错位。
