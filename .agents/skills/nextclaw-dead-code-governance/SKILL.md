---
name: nextclaw-dead-code-governance
description: 当用户要求扫描、识别、清理、常态化治理 NextClaw 仓库里的死代码、无用代码、unused files、unused exports、unused dependencies，尤其是核心包越来越臃肿、想删旧实现或做定期减债时使用。
---

# NextClaw 死代码治理

## 目标

把“感觉项目越来越臃肿”变成可重复、低误删风险的清理流程。

这个 skill 只负责死代码治理：找出并删除无引用、重复、过期、被新路径替代的代码。它不负责一般性能优化、功能重构或目录治理战役；若任务扩大到长期自治推进，再联动 `autonomous-maintainability-campaign`。

## 使用前提

默认联动并遵守：

- `nextclaw-delivery-workflow`
- `nextclaw-clean-implementation`
- `nextclaw-validation-workflow`
- `post-edit-maintainability-guard`
- `post-edit-maintainability-review`
- `nextclaw-iteration-log-governance`

如果触达 skill、AGENTS、命令或治理规则本身，同时联动：

- `nextclaw-agent-instructions-governance`

## 核心判断

死代码候选分三类：

1. `确定可删`：生产代码无引用、无 package exports、无 bin/脚本入口、无动态注册、无文档要求保留，且已有替代路径或本身无行为价值。
2. `疑似可删`：机器扫不到引用，但可能是公共 API、插件入口、协议类型、测试入口、构建资源、CLI/bin、动态 import 或外部包消费表面。
3. `暂不删除`：NCP 协议类型、SDK/export 表面、runtime/plugin 注册点、CLI/bin 入口、构建产物、资源文件、测试入口噪声、兼容迁移仍需要的旧路径。

默认只删除 `确定可删`。`疑似可删` 先列入报告或下一批验证，不在同一刀里硬删。

## 扫描流程

### 1. 先读上下文

先确认：

- 用户要的是只读审计，还是直接清理。
- 作用域是全仓库、核心包，还是某个 package。
- 当前工作区是否已有无关改动：`git status --short`。

核心包优先级通常是：

- `packages/nextclaw`
- `packages/nextclaw-core`
- `packages/nextclaw-runtime`
- `packages/nextclaw-app-runtime`
- `packages/nextclaw-server`
- `packages/ncp-packages/*`
- `packages/nextclaw-ui`

### 2. 只读扫描

优先使用仓库已有信号：

```bash
pnpm metrics:local
pnpm lint:maintainability:hotspots
```

再用 knip 扫死代码，按作用域收窄：

```bash
pnpm dlx knip --workspace <package-or-path> --include files,exports,dependencies --reporter compact --no-exit-code --max-show-issues 200
```

对生产路径可补：

```bash
pnpm dlx knip --production --workspace <package-or-path> --include files,exports,dependencies --reporter compact --no-exit-code --max-show-issues 200
```

对局部未用符号可补：

```bash
pnpm -C <package> exec tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```

### 3. 降噪过滤

knip 常见误报必须先过滤：

- `*.test.*`、`tests/`：多半是测试入口未配置，不等于可删。
- `ui-dist/`、`dist/`、`public/sw.js`、资源目录：可能是构建或发布资源。
- package `exports` 指向的类型和入口：可能被外部用户消费。
- CLI `bin`、scripts、worker entry、dynamic import、plugin manifest、runtime registry：不能只看静态 import。
- `index.ts` barrel 暴露的公共类型：先判断是否属于 API surface，再决定是否收窄导出。

### 4. 反查证据

删除前必须至少做一次源码反查：

```bash
rg -n "<symbol-or-file-stem>" packages scripts apps docs -g '!**/dist/**' -g '!**/ui-dist/**' -g '!**/node_modules/**'
```

同时检查：

- `package.json` 的 `exports`、`bin`、`files`、`scripts`
- `tsconfig.json` path alias
- 相关 `index.ts` barrel
- docs/logs 中是否只是历史记录，历史记录不能单独证明代码仍需保留

## 删除策略

优先顺序：

1. 重复实现：保留已有 canonical owner，删除旧复制品。
2. 无引用生产文件：确认没有入口或动态加载后删除。
3. 未使用 helper / 局部函数：直接删，避免为了修 lint 做空包装。
4. 旧 UI 组件 / 旧 hook：只有测试引用而生产无引用时，连同对应孤立测试一起评估。
5. unused dependency：最后处理；先确认源码、脚本、构建、peer/发布合同都不用。

每一刀要小，默认只做同一责任链的一组删除。不要把“死代码清理”顺手扩大成架构重构。

## 不要做的事

- 不要用 `knip --fix` 或自动删除文件。
- 不要删除用户未提交的无关改动。
- 不要因为机器标 unused 就删除公共 API、协议类型或插件入口。
- 不要靠压缩格式、缩短命名、折叠空白来满足非功能净减。
- 不要在同一批里混删多个无关 feature root，除非用户明确要求大规模治理。

## 验证闭环

触达 TypeScript 源码、类型或导入导出边界时，必须跑：

```bash
pnpm -C <package> tsc
```

源码清理还要跑 package lint：

```bash
pnpm -C <package> lint
```

如果 package lint 或全量治理被无关工作区改动阻塞，改跑当前触达文件的 targeted 版本，并在最终回复说明阻塞来源：

```bash
pnpm lint:new-code:governance -- --files <touched-files...>
```

定向测试优先跑被删除路径的替代 owner 或邻近行为测试：

```bash
pnpm -C <package> exec vitest run <relevant-tests...>
```

收尾必须跑：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files...>
pnpm check:governance-backlog-ratchet
```

删除后可复扫：

```bash
pnpm dlx knip --workspace <package-or-path> --include files,exports --reporter compact --no-exit-code --max-show-issues 120
```

## 汇报格式

最终汇报必须包含：

- 删除了什么，以及为什么确认可删。
- 保留了什么疑似项，以及为什么暂不删。
- `tsc`、lint、测试、maintainability guard、governance 的结果。
- 总代码增减、非测试代码增减。
- 正向减债动作，通常是 `删除` 或 `简化`。
- 是否新增或更新 `docs/logs` 迭代记录。
- 若全量治理被无关改动阻塞，说明 targeted 验证已覆盖本次触达范围。

## 常态化节奏

常态治理时，每轮只选择一个高置信批次：

1. 先扫核心包生产 unused files。
2. 再扫重复实现和旧 owner。
3. 再收敛 unused exports。
4. 最后处理 unused dependencies。

每完成一批，记录剩余候选和下一刀建议。若剩余项需要产品/API 兼容判断，停止并向用户报告，不要强行继续。
