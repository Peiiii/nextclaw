---
name: directory-structure-governance-overview
description: 当用户要求目录结构治理概况、整体问题概况、结构热点、目录问题量化、下一步治理优先级、长期结构债务地图，或用“概况”“热点”“整体情况”指代当前 module-structure/app-l1/app-l2/app-l3 治理状态时使用。用于输出可复现的量化概览，而不是直接开始重构。
---

# 目录结构治理概况

## 目标

把目录结构治理从临时口头判断变成可重复的概况扫描。

每次使用本 skill，默认回答：

- 当前有多少模块命中结构问题
- 当前有多少条结构发现
- 按协议、问题类型、模块、核心度排序后的热点
- 哪些问题最该先治理
- 哪些问题只是数量大但核心度较低
- 哪些是规范/脚本/contract 不一致，而不是业务代码本身的问题

默认只做概况和建议，不直接改代码。用户明确要求治理某个模块时，再切到标准交付流程。

## 核心原则

- 顶层结构规范优先于脚本现状；如果高层规范已定义但脚本没实现，优先判断为脚本漏实现。
- 协议白名单必须与高层结构规范对齐；不能靠新增开放型、冻结型、显式白名单型协议掩盖冲突。
- 问题优先级按 `核心度 x 结构发现数 x 影响面 x 迁移风险` 判断，不只按数量排序。
- 插件类问题可以单独分组；当用户说“先忽略插件”，不要让插件数量淹没 core / NCP / runtime 问题。
- 概况报告必须区分“协议已落地但债务未清”和“仍是 legacy contract / frozen root”。

## 标准扫描

先运行全量结构审计。该扫描复用当前 module-structure 规则，但按全量文件而不是 diff-only 视角汇总。

```bash
node --input-type=module - <<'NODE'
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { findModuleStructureContract } from './scripts/governance/module-structure/module-structure-contracts.mjs';
import { evaluateModuleStructureFindings } from './scripts/governance/module-structure/lint-new-code-module-structure.mjs';

const roots = ['apps', 'packages', 'workers'];
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.md']);
const files = [];

const walk = (dir) => {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const filePath = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'lib', 'ui-dist', '.next'].includes(entry.name)) continue;
      walk(filePath);
    } else if (exts.has(path.extname(entry.name))) {
      files.push(filePath);
    }
  }
};

for (const root of roots) walk(root);

const byModule = new Map();
const byProtocol = new Map();
const byMessage = new Map();

for (const filePath of files) {
  let contract;
  try {
    contract = findModuleStructureContract(filePath);
  } catch {
    continue;
  }
  if (!contract) continue;

  const findings = evaluateModuleStructureFindings({
    filePath,
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });
  if (!findings.length) continue;

  const moduleKey = contract.modulePath.replace(/\/src(?:\/cli)?$/, '');
  const moduleItem = byModule.get(moduleKey) ?? {
    count: 0,
    samples: [],
    protocol: contract.protocol || contract.organizationModel
  };
  moduleItem.count += findings.length;
  if (moduleItem.samples.length < 3) {
    moduleItem.samples.push(`${filePath}: ${findings[0].message}`);
  }
  byModule.set(moduleKey, moduleItem);

  const protocolKey = contract.protocol || contract.organizationModel;
  byProtocol.set(protocolKey, (byProtocol.get(protocolKey) || 0) + findings.length);

  for (const finding of findings) {
    const kind = finding.message
      .replace(/'.*?'/g, "'…'")
      .replace(/\b[a-z0-9-]+\//g, '…/');
    byMessage.set(kind, (byMessage.get(kind) || 0) + 1);
  }
}

const rows = [...byModule.entries()].sort((a, b) => b[1].count - a[1].count);
console.log('TOTAL_MODULES_WITH_FINDINGS', rows.length);
console.log('TOTAL_FINDINGS', rows.reduce((sum, [, item]) => sum + item.count, 0));
console.log('\nBY_PROTOCOL');
for (const [key, value] of [...byProtocol.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(value, key);
}
console.log('\nTOP_MESSAGES');
for (const [key, value] of [...byMessage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(value, key);
}
console.log('\nTOP_MODULES');
for (const [moduleKey, item] of rows.slice(0, 40)) {
  console.log(`${String(item.count).padStart(4)} ${String(item.protocol).padEnd(18)} ${moduleKey}`);
  for (const sample of item.samples) console.log(`     - ${sample}`);
}
NODE
```

## 核心度辅助扫描

需要判断“越核心越关键”时，再运行依赖影响面扫描。

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const packageFiles = String(cp.execSync("find packages apps workers -name package.json -print", { encoding: 'utf8' }))
  .trim()
  .split(/\n/)
  .filter(Boolean);
const nameByRoot = new Map();
const dependents = new Map();

for (const packageFile of packageFiles) {
  const root = path.dirname(packageFile);
  const json = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (!json.name) continue;
  nameByRoot.set(root, json.name);
  dependents.set(json.name, 0);
}

for (const packageFile of packageFiles) {
  const json = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const deps = Object.keys({ ...json.dependencies, ...json.devDependencies, ...json.peerDependencies });
  for (const dep of deps) {
    if (dependents.has(dep)) dependents.set(dep, dependents.get(dep) + 1);
  }
}

const rows = [];
for (const [root, name] of nameByRoot) {
  const configPath = path.join(root, 'module-structure.config.json');
  if (!fs.existsSync(configPath)) continue;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  rows.push({
    root,
    name,
    protocol: config.protocol || config.contractKind,
    deps: dependents.get(name) || 0
  });
}

rows.sort((a, b) => b.deps - a.deps || a.root.localeCompare(b.root));
for (const row of rows.slice(0, 30)) {
  console.log(`${String(row.deps).padStart(2)} deps ${row.protocol.padEnd(18)} ${row.name} ${row.root}`);
}
NODE
```

## 汇报格式

输出时保持短而信息密度高，默认包含：

1. 总览数字：模块数、发现数、按协议分布。
2. 问题类型：根目录越界、根文件越界、feature 出口缺失、CLI command 根问题、legacy frozen 债务等。
3. 热点 Top 10：每项包含模块、协议、发现数、典型样例。
4. 核心优先级：把 `nextclaw-core`、NCP 底座、runtime、CLI、UI、插件分层看。
5. 推荐下一步：只给 3-5 个最值得推进的治理方向。
6. 不确定项：如果发现高层规范与脚本协议不一致，明确标出并建议先修规范/脚本对齐。

## 优先级规则

默认排序：

- `P0`：核心底座、高依赖包、运行时主链路，例如 `nextclaw-core`、NCP 包、agent/runtime、CLI 主链路。
- `P1`：产品关键路径或生态基础能力，例如 app runtime、server、mcp、remote、marketplace worker。
- `P2`：数量大但影响面较局部的插件、demo、独立 app。

当用户要求“先忽略插件”时：

- 将 `packages/extensions/nextclaw-channel-plugin-*` 单独列到插件组。
- Top 10 主榜默认不让插件占据第一优先级。

## 结束判断

不要把概况报告说成“已解决”。概况只回答治理地图。

除非用户要求落地改动，否则不要创建分支、不要提交、不要改模块结构。
