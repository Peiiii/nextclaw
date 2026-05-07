# Beta Release Full Public Batch

## 迭代完成说明

本次将 beta 发布默认语义从“只为有 publish drift 的包生成 changeset”改为“为所有 `private=false` workspace 包生成统一 beta changeset”。这样用户只说发布 beta 时，`pnpm release:beta` 与 `pnpm release:beta:npm` 默认都会覆盖完整 public 包闭包，避免出现本地看到某个 beta 版本号，但 UI 静态资源或依赖包实际没有进入同一批发布的错觉。

同步完善了 `npm-beta-release` 与 `npm-release-contract-guard` skill：默认全量发布、缩小范围必须先说明例外原因、发布后必须用真实 `nextclaw@beta` 全局安装态验证，不能把 workspace link 或开发态当作用户安装态。

## 测试/验证/验收方式

- `node --check scripts/release/release-auto-changeset.mjs && node --check scripts/release/release-beta.mjs && node --check scripts/release/release-beta-npm.mjs`
- `node scripts/release/release-auto-changeset.mjs --check`
- `node scripts/release/release-beta.mjs --dry-run`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/release/release-auto-changeset.mjs scripts/release/release-beta.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`

`release:auto:changeset --check` 显示当前 pending changesets 已覆盖所有 public packages；`release:beta --dry-run` 显示默认命令为 `pnpm release:auto (full public workspace beta batch)`。

`pnpm check:governance-backlog-ratchet` 未通过，失败原因是当前工作区 doc file-name violations 为 `13`，超过 baseline `11`；本次新增的迭代目录与触达 skill 文件名均通过 diff 文件名治理，失败点来自现有工作区文档状态。

## 发布/部署方式

未执行 NPM 发布。本次只修改发布脚本和 release 规范，后续真实 beta 发布应直接使用：

```bash
pnpm release:beta
```

## 用户/产品视角的验收步骤

1. 运行 `pnpm release:beta -- --dry-run`，确认默认 batch 是 full public workspace beta batch。
2. 真实发布后运行 `npm install -g nextclaw@beta`。
3. 用 `npm ls -g nextclaw --depth=0`、`nextclaw --version` 与服务进程路径确认安装态来自全局 npm 包，而不是仓库 workspace。
4. 用 `/api/app/meta`、hashed UI assets 和浏览器行为确认用户看到的是已发布包内容。

## 可维护性总结汇总

本次属于发布基础设施规范修复，不是新增用户功能。脚本改动通过收敛实现保持非测试代码净增为 `0`：没有给 `release:beta` 增加平行发布分支，而是把默认全量语义收回到底层 `release:auto:changeset` owner。`release-beta.mjs` 只更新帮助与 dry-run 文案，避免文件继续膨胀。

maintainability guard 结果：Errors `0`，Warnings `1`。剩余 warning 是 `scripts/release/release-beta.mjs` 接近 500 行预算，本次未继续增加该文件行数。

## NPM 包发布记录

不涉及 NPM 包发布。
