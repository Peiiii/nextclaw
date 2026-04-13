# Scripts Directory Organization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把仓库根 `scripts/` 从巨石平铺目录重组为按职责分组的子树结构，在不改变脚本行为的前提下降低导航成本和目录治理压力。

**Architecture:** 采用“角色优先 + 最小迁移风险”的重组方式。把同链路脚本整体搬入 `scripts/governance/`、`scripts/release/`、`scripts/dev/`、`scripts/smoke/`、`scripts/docs/`、`scripts/desktop/`、`scripts/metrics/`、`scripts/deploy/`、`scripts/local/` 等子目录，尽量让相互依赖的脚本继续保持同目录，减少 import 改动面；同步更新 `package.json`、文档和技能引用，不保留根目录兼容 shim。

**Tech Stack:** git mv, package.json commands, repo-wide path reference updates, existing governance and maintainability validation

---

### Task 1: 定义目标子树与迁移边界

**Files:**
- Modify: `scripts/README.md`
- Create: `docs/plans/2026-04-13-scripts-directory-organization-plan.md`

**Step 1: 明确根目录只保留少量入口**

根 `scripts/` 最终只保留：

- `README.md`
- 已有真实子目录

不再保留大批 root-level `.mjs` / `.sh` 文件。

**Step 2: 定义职责子树**

- `scripts/governance/`
- `scripts/release/`
- `scripts/dev/`
- `scripts/smoke/`
- `scripts/docs/`
- `scripts/desktop/`
- `scripts/metrics/`
- `scripts/deploy/`
- `scripts/local/`

### Task 2: 搬迁治理、发布、开发和冒烟脚本

**Files:**
- Move: root-level `scripts/*.mjs` / `scripts/*.sh`
- Modify: moved scripts whose relative imports cross出当前分组

**Step 1: 优先搬迁同目录互相依赖的一组**

- governance 脚本与其测试一起搬
- release 脚本与其 helper 一起搬
- dev 脚本与其 support/test 一起搬
- smoke 脚本与其 support 一起搬

**Step 2: 仅修复必要相对路径**

若同组搬迁后路径仍可用，不额外改代码；只有跨目录依赖时才改 import。

### Task 3: 更新入口与引用

**Files:**
- Modify: `package.json`
- Modify: package-level `package.json` that call moved root scripts
- Modify: docs / AGENTS / workflows / logs / skills references that point to moved scripts

**Step 1: 更新运行入口**

确保根命令、包内 `prepublishOnly`、docs app build hook 都指向新路径。

**Step 2: 更新 repo 内可点击路径和命令示例**

至少修复：

- 当前活跃文档
- Rulebook / workflows
- skills 中的路径引用
- 本次相关历史治理文档

### Task 4: 更新目录治理说明与迭代留痕

**Files:**
- Modify: `scripts/README.md`
- Modify: `docs/logs/v0.16.11-touched-legacy-governance-hardening/README.md`

**Step 1: 去掉“根目录必须保持扁平”的旧表述**

改为说明当前子树结构和各职责入口。

**Step 2: 记录这是上一轮治理的同批次续改**

直接更新最近一次相关迭代 README，不新建新的细碎迭代目录。

### Task 5: 运行最小充分验证

**Files:**
- Validate: moved scripts and touched references

**Step 1: 运行脚本级 smoke / check**

至少覆盖：

- `pnpm lint:new-code:governance -- scripts package.json docs commands`
- `pnpm check:governance-backlog-ratchet`
- 受影响脚本的 `node --test`

**Step 2: 运行 targeted maintainability guard**

只检查本次触达的 `scripts/` 与引用文件，确认 root `scripts/` 目录预算显著下降。
