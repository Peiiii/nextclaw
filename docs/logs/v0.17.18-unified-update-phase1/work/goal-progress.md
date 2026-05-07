# Goal Progress

## 当前目标

把 beta 发布入口按语义拆成“全闭环 / 只发 npm / 只发 runtime channel”，并说明 runtime workflow 的必要成本与已消除的非必要耗时。

## 明确非目标

- 不把“runtime workflow 慢”误判成单纯 npm publish 慢。
- 不删除真实需要的四平台 runtime bundle 构建。
- 不抬高 `minimumLauncherVersion`。

## 冻结边界 / 不变量

- `pnpm release:beta` 的“本地 npm 发包”和“远端 runtime update channel”继续分层，不强行揉成一条本地构建流水线。
- 必须保留发布闭环：release asset、`gh-pages` manifest、公网 URL 至少要有清晰的主从校验关系。
- 优化点只能砍掉误判/重复等待，不能牺牲真实更新通道正确性。

## 已完成进展

- 已确认 runtime workflow 的必要成本：4 平台 runtime bundle 构建、签名、上传 release assets、发布 `gh-pages` manifest。
- 已确认并修掉一段非必要耗时：Pages 传播延迟导致 `release:beta` 误判失败。
- 已新增 3 个明确入口：
  - `pnpm release:beta`
  - `pnpm release:beta:npm`
  - `pnpm release:beta:runtime`
- 已新增：
  - `scripts/release/release-beta-npm.mjs`
  - `scripts/release/release-beta-runtime.mjs`
  - `scripts/release/release-runtime-manifest-verify.mjs`
- 已同步：
  - `package.json`
  - `commands/commands.md`
  - `AGENTS.md`
  - `npm-beta-release` / `npm-release-contract-guard`
  - `docs/workflows/npm-release-process.md`
- 已完成定向验证：
  - `node --check scripts/release/release-beta*.mjs scripts/release/release-runtime-manifest-verify.mjs`
  - `pnpm release:beta:npm -- --dry-run`
  - `pnpm release:beta:runtime -- --dry-run`
- `pnpm lint:new-code:governance`：通过
- maintainability guard：通过（1 个接近预算 warning，无 error）
- `pnpm check:governance-backlog-ratchet`：仍为历史 `docFileNameViolations 13 > 11`
- 已真实发布并闭环验证 split beta 入口：
  - `nextclaw@beta = 0.18.12-beta.9`
  - `pnpm release:beta:npm` 未触发新的 runtime workflow
  - `pnpm release:beta:runtime -- --version 0.18.12-beta.9 --branch master` 成功发布 `beta.9` runtime channel
  - runtime workflow `25454210414` 成功
  - GitHub release assets 齐全
  - `gh-pages` 与公网 manifest 最终均切到 `0.18.12-beta.9`

## 当前下一步

继续收紧 beta 发布性能：让 isolated worktree 场景自动继承项目根 `.npmrc`，并进一步缩小 `release:check` 的 batch scope，减少 package-only beta 的等待时间。

## 锚点计数器

20/20
