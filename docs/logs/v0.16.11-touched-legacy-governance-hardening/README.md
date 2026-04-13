# v0.16.11 Touched Legacy Governance Hardening

## 迭代完成说明

- 落地“新增阻断 + strict touched governance + backlog ratchet”三层治理机制，解决仓库长期存在的“新增文件约束强、触达存量约束弱”问题。
- 新增机器可读 contract 数据源 [`scripts/governance/touched-legacy-governance-contracts.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/touched-legacy-governance-contracts.mjs)，用于声明：
  - strict touched legacy source paths
  - strict touched flat directory paths
  - docs naming roots
  - strict touched legacy doc paths
  - governance backlog baseline 文件位置
- 升级现有源码命名治理：
  - [`scripts/governance/lint-new-code-file-names.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-file-names.mjs)
  - [`scripts/governance/lint-new-code-file-role-boundaries.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-file-role-boundaries.mjs)
  - [`scripts/governance/lint-new-code-flat-directories.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-flat-directories.mjs)
- 新增文档命名治理：
  - [`scripts/governance/doc-file-name-shared.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/doc-file-name-shared.mjs)
  - [`scripts/governance/lint-doc-file-names.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-doc-file-names.mjs)
  - [`scripts/governance/report-doc-file-name-violations.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/report-doc-file-name-violations.mjs)
- 新增 tracked backlog ratchet：
  - [`scripts/governance/check-governance-backlog-ratchet.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/check-governance-backlog-ratchet.mjs)
  - [`scripts/governance/governance-backlog-baseline.json`](/Users/peiwang/Projects/nextbot/scripts/governance/governance-backlog-baseline.json)
- 将 docs 命名 diff gate 接入 [`scripts/governance/lint-new-code-governance.mjs`](/Users/peiwang/Projects/nextbot/scripts/governance/lint-new-code-governance.mjs) 与根 [`package.json`](/Users/peiwang/Projects/nextbot/package.json) 的默认治理入口，并补充新命令：
  - `pnpm lint:new-code:doc-file-names`
  - `pnpm report:doc-file-naming`
  - `pnpm check:governance-backlog-ratchet`
- 同批次续改把仓库根 [`scripts/README.md`](/Users/peiwang/Projects/nextbot/scripts/README.md) 与脚本目录结构一起完成重组：
  - 根 `scripts/` 直接文件数从 `92` 降到 `1`
  - 根目录不再保留大量平铺脚本，统一改为 `governance / release / dev / smoke / docs / desktop / metrics / deploy / local` 等职责子树
  - 根 [`package.json`](/Users/peiwang/Projects/nextbot/package.json)、维护性控制台动态导入、技能脚本与工作流文档已同步指向新路径
- 同批次续改补齐脚本目录重组后的仓库根路径契约：
  - 新增共享 helper [`scripts/shared/repo-paths.mjs`](/Users/peiwang/Projects/nextbot/scripts/shared/repo-paths.mjs) 与测试 [`scripts/shared/repo-paths.test.mjs`](/Users/peiwang/Projects/nextbot/scripts/shared/repo-paths.test.mjs)
  - `dev / governance / local / smoke / desktop / metrics / docs / project-pulse` 下的仓库级脚本不再通过 `../..` 或 `..` 猜测 repo root，统一改为共享解析
  - 这次修正的目标不是“把层级多改一层”，而是消除目录重组后容易再次批量失效的脆弱实现
- 同步更新治理文档与元规则：
  - [治理计划文档](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-13-touched-legacy-governance-hardening-plan.md)
  - [脚本目录整理计划](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-13-scripts-directory-organization-plan.md)
  - [命名工作流](/Users/peiwang/Projects/nextbot/docs/workflows/file-naming-convention.md)
  - [红区治理工作流](/Users/peiwang/Projects/nextbot/docs/workflows/maintainability-hotspot-freeze.md)
  - [命令索引](/Users/peiwang/Projects/nextbot/commands/commands.md)
  - [AGENTS 规则](/Users/peiwang/Projects/nextbot/AGENTS.md)
  - [脚本目录说明](/Users/peiwang/Projects/nextbot/scripts/README.md)

## 测试/验证/验收方式

- 运行脚本测试：

```bash
node --test scripts/governance/lint-new-code-file-names.test.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs scripts/governance/lint-new-code-flat-directories.test.mjs scripts/governance/lint-doc-file-names.test.mjs scripts/governance/check-governance-backlog-ratchet.test.mjs
```

- 运行本次改动范围内的 diff-only 治理检查：

```bash
pnpm -s lint:new-code:governance -- scripts docs commands
```

- 运行 tracked backlog ratchet：

```bash
pnpm -s check:governance-backlog-ratchet
```

- 运行共享 repo root helper 单测：

```bash
node --test scripts/shared/repo-paths.test.mjs
```

- 运行真实开发入口冒烟：

```bash
NEXTCLAW_HOME="$(mktemp -d /tmp/nextclaw-dev-smoke.XXXXXX)" NEXTCLAW_DEV_BACKEND_PORT=18992 NEXTCLAW_DEV_FRONTEND_PORT=5199 pnpm dev start
```

- 运行平台开发入口 check：

```bash
pnpm dev:platform:stack --check
```

- 运行针对本次脚本改动的 maintainability guard：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/governance/touched-legacy-governance-contracts.mjs scripts/governance/doc-file-name-shared.mjs scripts/governance/report-doc-file-name-violations.mjs scripts/governance/lint-doc-file-names.mjs scripts/governance/lint-doc-file-names.test.mjs scripts/governance/check-governance-backlog-ratchet.mjs scripts/governance/check-governance-backlog-ratchet.test.mjs scripts/governance/governance-backlog-baseline.json scripts/governance/lint-new-code-file-names.mjs scripts/governance/lint-new-code-file-role-boundaries.mjs scripts/governance/lint-new-code-flat-directories.mjs scripts/governance/lint-new-code-file-names.test.mjs scripts/governance/lint-new-code-file-role-boundaries.test.mjs scripts/governance/lint-new-code-flat-directories.test.mjs scripts/governance/report-file-name-kebab-violations.mjs scripts/governance/lint-new-code-governance.mjs scripts/governance/maintainability-hotspots.mjs scripts/metrics/code-volume-metrics.mjs scripts/release/check-release-batch.mjs scripts/dev/dev-runner.mjs scripts/dev/dev-start-plugins.mjs scripts/dev/dev-process-status.mjs scripts/smoke/local-codex-plugin-smoke.mjs scripts/README.md package.json apps/maintainability-console/server/maintainability-data.service.ts
```

- 结果摘要：
  - 脚本测试通过
  - `repo-paths` 单测通过
  - `pnpm dev start` 冒烟通过，不再误报 `Missing local dev binaries`
  - `pnpm dev:platform:stack --check` 通过
  - diff-only 治理检查通过
  - backlog ratchet 通过，当前 tracked baseline 为：
    - source file-name violations: `81`
    - doc file-name violations: `11`
  - `scripts/` 目录结构重组后的 targeted guard 无 error；根目录已经从“平铺豁免”转为“子树收敛”，不再依赖旧的扁平目录例外说明

## 发布/部署方式

- 本次为仓库治理脚本、文档与命令入口变更，无需单独服务部署。
- 合入主干后，后续任务默认通过根 `package.json` 中的治理入口获得新行为：
  - `pnpm lint:new-code:governance`
  - `pnpm lint:maintainability:guard`
  - `pnpm check:governance-backlog-ratchet`

## 用户/产品视角的验收步骤

1. 新建一个不符合 kebab-case 的源码文件，例如 `apps/demo/src/FooBar.ts`，确认 `pnpm lint:new-code:governance` 直接阻断。
2. 在 strict touched source 路径中修改一个历史 legacy 文件，例如 `apps/platform-admin/src/pages/LoginPage.tsx`，确认命名违规从 warning 升级为 error。
3. 在普通 legacy 路径中修改一个历史 legacy 文件，确认仍保持 warning，不会一口气炸全仓。
4. 新建一个不符合规则的文档文件，例如 `docs/plans/RuntimeControlPlan.md`，确认 docs 命名 diff gate 直接阻断。
5. 人为增加 tracked backlog 基线以外的命名债务，运行 `pnpm check:governance-backlog-ratchet`，确认会失败。

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是。本次目标不是清理某一批具体业务文件，而是把历史债务治理从“靠人记得顺手改”升级为“有 contract、有 strict touched 范围、有 backlog ratchet”的默认机制。
- 是否优先遵循删减优先、简化优先、代码更少更好原则：是。没有新增新的大型治理框架，也没有引入数据库或额外配置层；复用现有 diff gate、报告脚本和命令入口，只补最小必要的 contract、docs helper 和 ratchet。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次文件数净增长，属于最小必要新增。增长来自 docs 命名治理与 backlog ratchet 的新脚本和测试；同步偿还的维护性债务是把“存量永远只是 warning”的机制缺口补上，并把 docs 命名首次纳入自动治理主链路。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适：更合适。治理契约、docs 命名共享逻辑、report/check 入口分离清晰，避免把所有逻辑继续堆进单一脚本。
- 目录结构与文件组织是否满足当前项目治理要求：是，而且比上一轮更进一步。治理脚本已收敛到 `scripts/governance/` 等职责子树，根 `scripts/` 只保留 `README.md` 与子目录，目录平铺度显著下降；这次又把“目录结构整理”继续推进到了“共享路径契约收口”，脚本目录已不再依赖子目录深度这一隐式前提，后续再调整 `scripts/` 子树时不会因为 root 推导散落在各文件里而批量失效。
- 若本次涉及代码可维护性评估，是否基于独立于实现阶段的 `post-edit-maintainability-review`：是。结论为“通过，但保留明确后续扩围位点”。本次顺手减债：是。减掉的是“只有新增受约束、存量永远弱约束”的机制债。
- 长期目标对齐 / 可维护性推进：本次顺着“代码更少、规则更明确、结构更清晰、治理更可预测”的长期方向又推进了一小步。不只是把历史命名债务治理从“纯人工提醒”推进到“自动阻断新增 + 分批 strict touched + backlog 不反弹”的闭环，还把 `scripts/` 从巨石平铺目录收成明确子树，并补上统一 repo root 契约，避免未来继续靠目录层级这种隐式状态制造 surprise failure。下一步最合理的推进位点，是继续扩大 strict touched governance 覆盖目录，并按 baseline 报告分批消化 `81 + 11` 的历史命名债务。
