# 迭代完成说明

本迭代用于持续治理 `packages/nextclaw-ui` 的目录组织可维护性债务，目标是在不引入新用户能力的前提下，按高置信批次逐层收敛目录平铺、角色混杂与命名漂移问题，使模块逐步符合仓库治理规范。

当前战役范围：

- 优先处理 `nextclaw-ui` 中直接代码文件数超预算、可稳定按子域/角色收拢的热点目录
- 每次只推进一个高置信批次，完成后立即验证、执行治理守卫与主观复核
- 每完成一个目录层级优化并确认仍可正常运行，就提交一个独立 commit
- 执行约定：每一轮完成并提交后自动进入下一轮，不等待额外人工催促；只有遇到低置信阻塞或治理硬失败时才停下并记录原因

当前进展请见：

- [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md)
- [work/state.json](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/state.json)

当前已确认的关键根因：

- [packages/nextclaw-ui/module-structure.config.json](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/module-structure.config.json) 将该模块声明为 `frontend-l3`
- 该协议下 allowed roots 只有 `app`、`features`、`shared`、`platforms`
- 当前 `rootPolicy=legacy-frozen`，因此不能继续在 legacy roots（如 `components`、`lib`、`api`、`hooks`）下直接新增目录层级
- 首批尝试在 `components/config` 下新建 provider 子树已被治理闸门阻断，并已回撤代码尝试；后续必须改成 contract-aligned 的迁移路径
- 第一批真正通过治理的落点是把 `components/config/security-config.tsx` 的真实实现迁入 `features/system-status/components/security-config.tsx`，旧路径只保留薄转发入口，从而在不碰 `app.tsx` 历史命名冲突的前提下完成一次 allowed-root 迁移
- 第二批通过治理的落点是把 `components/config/runtime-presence-card.tsx` 的真实实现迁入 `features/system-status/components/runtime-presence-card.tsx`，旧路径收窄为兼容导出，并顺手消除了重复的卡片壳结构
- 第三批通过治理的落点是把通用布局壳 `components/config/config-split-page.tsx` 的真实实现迁入 `shared/components/config-split-page.tsx`，旧路径仅保留兼容导出，为多个配置页面后续继续脱离 legacy root 铺平道路
- 第四批通过治理的落点是把 `provider-pill-selector.tsx` 与 `provider-status-badge.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，开始把 provider 相关小型通用 UI 原件从 `components/config` 中剥离出来
- 第五批通过治理的落点是把 `provider-enabled-field.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，继续把 provider 配置表单中的通用开关行从 `components/config` 中抽离

# 测试 / 验证 / 验收方式

当前为进行中迭代。每个批次默认执行以下最小验证并把结果增量补充到本文件与 `work/` 状态中：

- 受影响范围的测试或类型检查
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files...>`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 一次独立于实现阶段的可维护性复核

本轮额外确认：

- 已执行一次真实失败验证，确认 legacy-root 直拆会同时触发 `module-structure`、目录预算和非功能净增闸门
- 已回撤失败代码路径，当前仓库未保留这次未通过治理检查的半成品结构
- 当前首个成功批次已完成以下验证：
- 当前第二个成功批次已完成以下验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第二批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/runtime-presence-card.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第三批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/SearchConfig.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第四批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第五批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 验证结果：
  - 路由相关测试通过，说明配置页入口仍可正常装载
  - 类型检查通过
  - 治理检查通过；仅保留一条历史告警，提示 `components/config` 目录本身仍超预算，但本批次没有继续恶化该问题
  - 非测试代码净变化为负值，符合“非功能批次不得净增”的要求
  - `runtime-presence-card` 的测试通过，说明桌面态与本地服务态的关键展示/交互仍可工作
  - `config-split-page` 迁移后受影响页面测试仍通过，且第三批非测试代码净变化为 `0`
  - `provider` 相关列表测试通过，且第四批非测试代码净变化为负值
  - `provider-enabled-field` 第五批验证通过，非测试代码净变化继续为负值

# 发布 / 部署方式

本迭代聚焦目录治理，不涉及独立部署。若某批次仅调整前端源码目录结构，则以通过最小验证并合入代码为生效方式。

# 用户 / 产品视角的验收步骤

1. 打开 [packages/nextclaw-ui/src](</Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src>)，确认热点目录不再长期维持大规模平铺。
2. 检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md)，确认当前活跃批次、已完成批次与下一步持续更新。
3. 检查对应 commit 与验证记录，确认每一层目录优化都在可运行前提下独立收敛。
4. 若当前尚未出现目录优化 commit，先检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md) 中记录的阻塞与下一步，确认战役没有在错误路径上继续累积垃圾改动。
5. 当前至少应看到五处 contract-aligned 的迁移样例：`security-config`、`runtime-presence-card` 的真实实现位于 `features/system-status/components`，`config-split-page`、`provider-pill-selector`、`provider-status-badge`、`provider-enabled-field` 的真实实现位于 `shared/components`，而 legacy 路径只保留兼容导出。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是，就当前这一批次而言已经做到最小必要收敛。我们没有继续扩张 legacy roots，而是把一个已有系统状态页面的真实实现迁入 allowed root，并保留最薄兼容入口，避免一次性撕裂历史调用面。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本批次没有新增用户能力，只做实现归位与兼容出口收窄；旧文件由完整页面实现降为单行转发，复杂度明显下降。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。当前五个成功批次中，除第三批为零增长外，其余批次都实现了非测试代码负增长；`components/config/security-config.tsx`、`components/config/runtime-presence-card.tsx`、`components/config/config-split-page.tsx`、`components/config/provider-pill-selector.tsx`、`components/config/provider-status-badge.tsx` 与 `components/config/provider-enabled-field.tsx` 都已经收窄为兼容出口。`components/config` 顶层文件数仍未下降，需要后续继续把其它实现在 allowed roots 中沉淀下来。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`security-config` 与 `runtime-presence-card` 都属于系统状态与运行环境展示面，落到既有 `features/system-status` 更符合模块边界；`config-split-page`、`provider-pill-selector`、`provider-status-badge`、`provider-enabled-field` 则是跨多个配置页面复用的 UI 原件，迁入 `shared/components` 后边界更清晰。整个过程没有引入新的假角色目录或额外 helper。

目录结构与文件组织是否满足当前项目治理要求：部分改善，但仍未完全满足。`packages/nextclaw-ui/src/components/config`、`components/chat`、`components/ui`、`lib`、`api` 等目录仍是热点；当前已经证明正确入口是“迁入 allowed roots，再把旧路径缩成兼容层”，并且 allowed roots 现已同时打通 `features` 与 `shared` 两条迁移路径。下一步应继续挑选 `components/config` 中已是 kebab-case、语义上可并入既有 feature 或 shared 的页面、卡片与小型 UI 原件推进。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：适用。本批次独立复核结论为“通过，继续推进下一层级”。原因是这一步确实减少了 legacy 目录中的实质实现代码，且没有把复杂度转移成新的横向耦合；唯一保留风险是 `components/config` 的目录预算债务仍在，需要后续连续批次继续偿还。

# NPM 包发布记录

不涉及 NPM 包发布。
