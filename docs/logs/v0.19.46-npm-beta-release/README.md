# v0.19.46 NPM Beta Release

## 迭代完成说明

本次按用户要求再次发布 NPM beta。初始入口执行了 `pnpm release:beta`，在用户补充“只发布 npm 就行”前，脚本已经完成 NPM 发布、registry 校验、release commit 与 tag push；后续按最新范围停止额外等待，不再追加 runtime 冒烟。

本次 NPM 发布结果：

- `nextclaw@beta`：`0.19.31-beta.4`
- release commit：`854abec6c...`（`chore: release beta batch`）
- 发布 batch：46 个 public workspace 包

## 测试/验证/验收方式

- `pnpm release:beta -- --dry-run`：确认会执行全量 public workspace beta batch。
- `pnpm release:beta`：完成 release check、npm publish、`release:verify:published` 与 release commit/tag push。
- `release:verify:published`：确认 46/46 个 package versions 已在 npm registry 可见。
- `npm view nextclaw@beta version`：返回 `0.19.31-beta.4`。
- `npm view nextclaw dist-tags --json`：确认 `latest = 0.19.28`、`beta = 0.19.31-beta.4`。

## 发布/部署方式

本次 NPM 发布通过仓库 release 入口完成：

```bash
pnpm release:beta
```

用户随后将范围收束为 npm-only，因此本记录只按 NPM registry 发布验收收尾。后端数据库 migration、独立线上 API deploy、额外 runtime 冒烟均不适用。

## 用户/产品视角的验收步骤

1. 执行 `npm view nextclaw@beta version`，应显示 `0.19.31-beta.4`。
2. 安装 `nextclaw@beta`。
3. 执行 `nextclaw --version`，应显示 `0.19.31-beta.4`。

## 可维护性总结汇总

本次主要是 NPM 发布闭环，不新增业务源码。版本、changelog、UI dist、changeset 与 package tags 均由标准 release 脚本生成并提交。未新增手工发布路径。

按用户最新 npm-only 范围，本次未追加新的源码修改，因此不额外运行 maintainability guard/review。

## NPM 包发布记录

需要发布，原因是用户明确要求再次发布 beta，且 `release:report:health` 显示 public workspace beta batch 存在未发布漂移。

已发布 batch 共 46 个 public workspace 包，核心安装入口为：

- `nextclaw@0.19.31-beta.4`

发布后 `release:verify:published` 确认 registry 上 46/46 个 package version 均可见。`nextclaw` dist-tag 当前为 `latest = 0.19.28`、`beta = 0.19.31-beta.4`。
