# 2026-04-08 Auto Release Batch Plan

## 背景

当前仓库虽然已经有：

- `release:report:health`
- `release:check`
- `release:verify:published`

但真实使用时仍然存在一个效率缺口：

1. 有些 public package 的精确版本其实已经在 npm 上了，只是本地 git tag 没补齐。
2. 有些 package 在“上次 version 提交之后”又继续改了源码或 package manifest，但没有新的 changeset。
3. 现有主链路没有一个单命令入口把这两类情况自动收敛成“下一轮真正该发什么”。

结果就是发布前还要人工逐个比对 tag、registry、最近提交和包目录漂移，效率很差，也容易误判。

## 目标

本次只补最小必要自动化，不重做 release 系统：

1. 自动同步“已发布但缺本地 tag”的公共包。
2. 自动识别“自上次 version 之后又发生有效漂移”的公共包。
3. 自动为这些真实 drift 包生成 changeset。
4. 提供 `pnpm release:auto` 一键闭环入口。

## 非目标

- 不修改 `changeset publish` 的发布语义。
- 不引入新的 registry fallback 或隐藏 rescue path。
- 不把“缺 tag”直接等价成“未发布”。
- 不为单次事故写不可复用脚本。

## 方案

### 1. 在 `release-scope` 中补齐“版本提交后漂移”能力

新增共享 helper：

- `readLatestPackageVersionCommit(entry)`
- `readMeaningfulVersionDrift(entry)`

统一基于“最近一次触碰该包 `package.json` 的 commit”作为上次 version 边界，然后沿用已有的
`isMeaningfulReleaseDrift(...)` 过滤规则，避免再造一套 drift 判定逻辑。

### 2. 自动同步已发布 tag

新增 `scripts/sync-published-release-tags.mjs`：

- 只处理 public package
- 条件必须同时满足：
  - 当前 `name@version` 本地缺 tag
  - npm registry 上存在精确 `name@version`
  - 该包在最近 version commit 之后没有 meaningful drift

满足条件才允许自动创建本地 tag，避免把“其实有未发布改动”的包错误地封口。

### 3. 自动生成 release changeset

新增 `scripts/release-auto-changeset.mjs`：

- 扫描所有 public package 的 `readMeaningfulVersionDrift(...)`
- 只为“有 drift 且未被现有 pending changeset 覆盖”的包生成一个统一 patch changeset
- 若已有 pending changeset 覆盖，则复用，不重复生成

### 4. 提供一键入口

新增 package scripts：

- `release:sync:published-tags`
- `release:sync:published-tags:write`
- `release:auto:changeset`
- `release:auto:prepare`
- `release:auto`

其中 `release:auto` 按顺序执行：

1. 同步已发布 tag
2. 自动生成 changeset
3. `release:version`
4. `release:publish`

## 验证

至少执行：

- `node --check scripts/release-scope.mjs`
- `node --check scripts/sync-published-release-tags.mjs`
- `node --check scripts/release-auto-changeset.mjs`
- `pnpm release:sync:published-tags`
- `pnpm release:auto:changeset --check` 或等价 dry-run
- `pnpm release:auto:prepare`
- `pnpm lint:maintainability:guard`

如果继续执行真实发布，则再补：

- `pnpm release:auto`
- registry exact-version 核验

## 预期结果

- 以后不需要再人工逐个包核对“到底是不是这次该发的内容”。
- 已发布但缺 tag 的旧批次会先被自动收口，不再污染下一轮 release batch。
- 真正有 post-version drift 的包会被自动纳入 changeset。
- 发布闭环可直接走 `pnpm release:auto`。
