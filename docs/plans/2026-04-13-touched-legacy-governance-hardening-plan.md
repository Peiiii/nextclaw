# Touched Legacy Governance Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把“新增文件强约束、触达存量弱约束”的现状升级为一套可渐进收敛历史债务的自动化治理闭环，同时把文档命名也纳入统一治理入口。

**Architecture:** 延续仓库现有的 diff-only maintainability gate，不做全仓一次性清债；新增“治理契约 + 触达升级 + baseline ratchet”三层机制。源码/脚本/测试继续走 `lint:new-code:governance` 主链路，文档命名通过新的 docs 治理脚本接入同一收尾入口，并为后续目录级 strict mode 留出数据源。

**Tech Stack:** Node.js governance scripts, existing maintainability guard, package.json commands, Markdown workflow docs

---

### Task 1: 定义治理契约与计划边界

**Files:**
- Modify: `docs/workflows/file-naming-convention.md`
- Modify: `commands/commands.md`
- Modify: `AGENTS.md`
- Create: `scripts/governance/touched-legacy-governance-contracts.mjs`

**Step 1: 明确本次机制必须解决的问题**

写清三件事：

- 哪些 legacy 问题在“触达时”必须升级为 hard error
- 哪些问题仍保留 warning，但必须给出保留债务理由
- 哪些目录/文档范围纳入 baseline ratchet

**Step 2: 设计机器可读 contract 数据源**

contract 至少包含：

- `strictTouchedLegacyPaths`
- `strictTouchedDirectoryPaths`
- `docsNamingRoots`
- `docsLegacyBacklogAllowlist`（若需要）
- `baselineRatchetReports`

**Step 3: 保持范围收敛**

本轮只做机制层，不展开业务文件批量重命名或目录重构。

### Task 2: 实现源码/脚本/测试的 touched legacy 升级

**Files:**
- Modify: `scripts/governance/lint-new-code-file-names.mjs`
- Modify: `scripts/governance/lint-new-code-file-role-boundaries.mjs`
- Modify: `scripts/governance/lint-new-code-flat-directories.mjs`
- Test: `scripts/governance/lint-new-code-file-names.test.mjs`
- Test: `scripts/governance/lint-new-code-file-role-boundaries.test.mjs`
- Test: `scripts/governance/lint-new-code-flat-directories.test.mjs`

**Step 1: 让脚本读取 contract**

在 legacy touched file / touched directory 判断分支里，根据 contract 把 warning 升级为 error。

**Step 2: 保持 diff-only 原则**

只对本次触达路径生效，不做全仓 blocking。

**Step 3: 补测试**

覆盖三种行为：

- 非 strict 范围 legacy touched 仍然 warning
- strict 范围 legacy touched 升级为 error
- 新增/重命名规则保持原有行为不回归

### Task 3: 把文档命名纳入主链路

**Files:**
- Create: `scripts/governance/report-doc-file-name-violations.mjs`
- Create: `scripts/governance/lint-doc-file-names.mjs`
- Create: `scripts/governance/lint-doc-file-names.test.mjs`
- Modify: `package.json`
- Modify: `scripts/governance/lint-new-code-governance.mjs`

**Step 1: 约束文档命名规则**

优先覆盖：

- `docs/**/*.md`
- `apps/docs/{en,zh}/guide/**/*.md`

规则以 kebab-case 文档名为主，并保留 `README.md` 等少量显式例外。

**Step 2: 提供报告入口**

新增全仓 docs backlog 报告命令，和源码命名报告形成对称结构。

**Step 3: 接入默认收尾入口**

让 docs 命名检查进入 `pnpm lint:maintainability:guard` 的统一调用链。

### Task 4: 增加 baseline ratchet

**Files:**
- Create: `scripts/governance/check-governance-backlog-ratchet.mjs`
- Create: `scripts/governance/check-governance-backlog-ratchet.test.mjs`
- Modify: `package.json`

**Step 1: 定义 baseline 文件**

以 JSON 记录当前历史债务数量：

- `sourceFileNameViolations`
- `docFileNameViolations`

**Step 2: 实现只降不升检查**

若报告结果高于 baseline，则失败；若降低，则通过。

**Step 3: 先覆盖命名债务**

本轮只把命名债务接入 ratchet，不把目录结构拓扑债务一并纳入，避免一次扩太大。

### Task 5: 更新工作流与项目规则

**Files:**
- Modify: `docs/workflows/file-naming-convention.md`
- Modify: `commands/commands.md`
- Modify: `AGENTS.md`

**Step 1: 把“触达即整改”从软要求写成分阶段机制**

要明确：

- strict touched governance
- docs 命名治理
- baseline ratchet

**Step 2: 与现有规则对齐**

避免和已有“diff-only”“incremental paydown”“frozen directory”规则冲突。

### Task 6: 记录迭代、验证并提交

**Files:**
- Create: `docs/logs/v0.16.11-touched-legacy-governance-hardening/README.md`

**Step 1: 运行最小充分验证**

至少包括：

- 新增/更新脚本测试
- `pnpm lint:new-code:governance`
- `pnpm lint:maintainability:guard`
- `pnpm check:governance-backlog-ratchet`

**Step 2: 记录 maintainability 结论**

在迭代 README 中写明：

- 本次顺手减债点
- 为什么这次没有直接全仓清债
- 下一步如何继续扩大 strict 范围

**Step 3: 提交**

使用英文提交信息，且仅提交本次治理相关文件。
