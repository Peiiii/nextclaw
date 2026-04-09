# v0.15.68-react-effect-owner-boundary

## 迭代完成说明

- 新增 [`scripts/lint-new-code-react-effects.mjs`](../../../scripts/lint-new-code-react-effects.mjs)，把“React effect 只用于外部系统同步”的边界收成 diff-only AST 检查：
  - 只检查本次触达的 `useEffect` / `useLayoutEffect`
  - 默认阻断高置信度业务型 effect：直接调用本地 state setter、selected store action、`mutate/mutateAsync`、`invalidateQueries`、`refetch`、`setQueryData` 等 query / mutation / cache 动作
  - 默认不拦 DOM 同步、浏览器事件监听、订阅生命周期以及 effect 内嵌套回调中的 setter，避免把 runtime 订阅类 effect 一起打成噪音
- 本次复用了当前主链里已经存在的 `react-effects-owner-boundary` 规则命名与治理入口定义，不再重复改动 Rulebook / package / governance 接线，只补齐缺失的脚本实现。
- 新增 [`scripts/lint-new-code-react-effects.test.mjs`](../../../scripts/lint-new-code-react-effects.test.mjs)，覆盖：
  - touched effect 里直接调用本地 state setter 与 selected store action
  - touched effect 里直接触发 query / mutation 动作
  - DOM / event-listener 边界同步 effect 默认放行
  - 同文件 untouched effect 不受影响
- 更新 [`mvp-view-logic-decoupling` skill](../../../.agents/skills/mvp-view-logic-decoupling/SKILL.md)、[`post-edit-maintainability-guard` skill](../../../.agents/skills/post-edit-maintainability-guard/SKILL.md) 与 [`post-edit-maintainability-review` skill](../../../.agents/skills/post-edit-maintainability-review/SKILL.md)，把 `store / manager / presenter / query-view hook` 的 owner 边界写进现有 skill 指南与复核语义。
- 额外沉淀方案文档 [`2026-04-09-react-effect-governance-plan.md`](../../../docs/plans/2026-04-09-react-effect-governance-plan.md)，记录首版治理范围、白名单边界和 rollout 策略。

## 测试/验证/验收方式

- 已执行：
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/lint-new-code-react-effects.test.mjs`
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH node --test scripts/lint-new-code-class-methods.test.mjs scripts/lint-new-code-object-methods.test.mjs scripts/lint-new-code-param-mutations.test.mjs`
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH node scripts/lint-new-code-react-effects.mjs -- scripts/lint-new-code-react-effects.mjs scripts/lint-new-code-react-effects.test.mjs`
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:new-code:governance -- scripts/lint-new-code-governance.mjs scripts/lint-new-code-react-effects.mjs scripts/lint-new-code-react-effects.test.mjs`
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths AGENTS.md commands/commands.md .agents/skills/mvp-view-logic-decoupling/SKILL.md .agents/skills/post-edit-maintainability-review/SKILL.md .agents/skills/post-edit-maintainability-guard/SKILL.md package.json scripts/lint-new-code-governance.mjs scripts/lint-new-code-react-effects.mjs scripts/lint-new-code-react-effects.test.mjs docs/plans/2026-04-09-react-effect-governance-plan.md`
- 结果：
  - 新增的 React effect diff-only 检查与对应单测全部通过。
  - 现有 class / object / param-mutation 治理脚本单测仍通过，说明聚合入口接线没有破坏既有治理能力。
  - 定向 maintainability guard 通过，只有两条 warning：
    - `scripts/` 目录预算豁免警告，属于仓库已有目录豁免场景
    - `scripts/lint-new-code-react-effects.mjs` 接近文件预算上限（`433/500`），当前作为首版单文件 AST 检查接受，后续若继续扩规则应优先拆 helper
- 未通过但已判定与本次改动无关：
  - `PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 失败原因来自当前工作区其它并行业务改动触发的既有/外部预算问题，包括：
    - `packages/nextclaw/src/cli/commands/platform-auth.ts`
    - `workers/marketplace-api/src/infrastructure/d1-data-source.ts`
    - `workers/marketplace-api/src/infrastructure/in-memory-section-repository-base.ts`
    - `workers/nextclaw-provider-gateway-api/src/repositories/platform-repository.ts`
    - `workers/nextclaw-provider-gateway-api/src/utils/platform-utils.ts`
- 不适用项：
  - `build`：不适用。本次只改治理脚本、规则和文档，不触达构建产物链路
  - `tsc`：不适用。本次新增的是根目录 `.mjs` 脚本与 Markdown 文档，不属于 TypeScript 编译产物

## 发布/部署方式

- 本次改动属于仓库内治理增强，无独立部署、发版、migration 或线上发布步骤。
- 合入后，后续所有运行 `pnpm lint:new-code:governance` 或 `pnpm lint:maintainability:guard` 的开发收尾流程，都会对新增的高置信度业务型 React effect 执行阻塞检查。

## 用户/产品视角的验收步骤

1. 打开 [`AGENTS.md`](../../../AGENTS.md)，确认 `react-effect-boundary-only` 已明确要求：effect 只负责外部系统同步，业务动作应回到 `query / store / manager / presenter`。
2. 打开 [`scripts/lint-new-code-react-effects.mjs`](../../../scripts/lint-new-code-react-effects.mjs)，确认首版只拦高置信度坏味道，而不是全量扫描所有历史 effect。
3. 在一个已修改的 React 文件里保留类似 `useEffect(() => setUser(meQuery.data.user), [meQuery.data])` 或 `useEffect(() => mutation.mutate(), [id])` 的写法，运行 `pnpm lint:new-code:react-effects -- <path>`，确认会直接失败。
4. 将同一逻辑迁回 `query/view hook`、`store`、`manager` 或 `presenter` 后重新运行同一命令，确认检查通过。
5. 阅读 [`mvp-view-logic-decoupling` skill](../../../.agents/skills/mvp-view-logic-decoupling/SKILL.md)，确认现有 MVP 架构已经把 effect 边界收口成统一规则，而不是额外新增一套平行机制。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 这次顺着“代码更少、边界更清晰、行为更可预测”的长期方向推进了一小步：把原本只能靠人工 review 才能稳定发现的 effect 业务补丁味道，收进现有 Rulebook + skill + diff-only governance 主链。
  - 本次优先推进的最小维护性改进是：只阻断新增的高置信度业务型 effect，不追杀全仓历史代码，也不另起一套 ESLint 插件或平行治理框架。
  - 暂未继续推进的点是更深层的 alias / wrapper / indirect callback 场景；后续若规则继续扩展，优先从 [`scripts/lint-new-code-react-effects.mjs`](../../../scripts/lint-new-code-react-effects.mjs) 拆出共享 helper，避免单文件继续膨胀。
- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：
  - 新增：760 行
  - 删除：3 行
  - 净增：+757 行
- 非测试代码增减报告：
  - 新增：624 行
  - 删除：3 行
  - 净增：+621 行
- 可维护性发现：
  1. [`scripts/lint-new-code-react-effects.mjs`](../../../scripts/lint-new-code-react-effects.mjs) 首版落地后已接近文件预算告警线（`433/500`）。
  2. 这会让后续继续往同一脚本里堆规则时，更容易出现“治理脚本本身变成新热点”的反噬。
  3. 更小/更简单的后续修法是：若下一轮继续扩 React effect 规则，优先把 React import 解析、binding 收集和 effect callback 扫描拆到共享 helper，而不是继续把复杂度留在单文件里。
- 可维护性总结：这次改动没有另起一套“前端哲学”，而是把 React effect 问题并回现有 owner-boundary 治理体系，属于最小必要新增。净增主要来自新脚本、测试与规则接线，但同步偿还的是“`useEffect` 脆弱性只能靠口头提醒”的维护性债务；当前保留的 watchpoint 是新脚本体积接近预算线，后续若继续扩治理范围应先做脚本内部分拆。
- 本次是否已尽最大努力优化可维护性：是。优先复用现有 `lint-new-code-*`、Rulebook 和 maintainability skill 主链，没有新增平行配置体系或第二套守卫入口。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有批量重构历史 React 页面，而是用最小 diff-only 阻断配合既有 owner 架构收口新债，并复用仓库里已有的治理入口命名。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次新增了 2 个脚本文件和 2 个文档文件，属于把人工 review 规则固化成自动治理所需的最小必要增长；同步偿还的是“业务型 effect 可继续无约束新增”的维护性债务。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。规则声明、skill 指南、diff-only 检查与聚合入口仍然留在现有治理层；业务 owner 继续明确指向 `query / store / manager / presenter`，没有把 effect 再包装成新的抽象壳。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次新增文件继续位于既有 `scripts/` 与 `docs/` 职责域中；`scripts/` 目录存在既有预算豁免，本次未新增新的错层目录，但新脚本已接近文件预算线，后续扩展时应优先拆 helper。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。上述结论基于定向 guard 结果之外的独立复核填写，重点判断了“是否复用既有治理体系”“是否把 effect 业务脆弱性收回 owner 边界”“新增脚本体积是否已到需要立即拆分的程度”。
