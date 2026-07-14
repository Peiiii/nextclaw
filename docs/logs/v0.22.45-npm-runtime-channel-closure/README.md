# v0.22.45 NPM Runtime Channel Closure

## 迭代完成说明

- 根因：`nextclaw@0.22.4` 已发布到 npm `latest`，但 NPM runtime update stable manifest 仍停在 `0.21.12`。NPM 安装态旧版本不会直接查询 npm registry 的 `latest`，而是通过 `npm-runtime-updates/stable/manifest-stable-<platform>-<arch>.json` 判断可用更新。
- 确认方式：用户提供的 NPM 安装实例 `0.22.3` 在 `/api/runtime/update` 返回 `status: "up-to-date"`，同时公网 stable manifest 返回 `latestVersion: "0.21.12"`。发布 stable runtime channel 后，同一实例返回 `availableVersion: "0.22.4"`。
- 修复方式：触发并等待 `npm-runtime-update-release` workflow 完成 stable channel 发布，补齐 `nextclaw@0.22.4` runtime bundle assets 与 `gh-pages` stable manifests。
- 机制改动：新增 `pnpm release:stable:runtime` 入口，复用 runtime channel 发布脚本并支持 `--channel stable`；同步更新 NPM release skill 与命令索引，要求 stable NPM 发布后闭合 runtime channel。

## 测试/验证/验收方式

- `npm view nextclaw version dist-tags --json`：确认 npm `latest` 为 `0.22.4`。
- `gh run watch 29334981238 --repo Peiiii/nextclaw --exit-status`：确认 stable runtime workflow 成功。
- `gh release view nextclaw@0.22.4 --repo Peiiii/nextclaw`：确认四个平台 runtime zip assets 存在。
- `curl https://peiiii.github.io/nextclaw/npm-runtime-updates/stable/manifest-stable-darwin-arm64.json`：确认公网 stable manifest 为 `latestVersion: "0.22.4"`。
- `curl -X POST http://127.0.0.1:55667/api/runtime/update/check` 后读取 `/api/runtime/update`：确认用户提供的 `0.22.3` NPM 安装实例看到 `availableVersion: "0.22.4"`。
- `node --check scripts/release/release-beta-runtime.mjs`：脚本语法检查通过。
- `pnpm release:stable:runtime -- --dry-run --version 0.22.4 --branch master`：stable runtime dry-run 通过。
- `pnpm release:beta:runtime -- --dry-run --version 0.21.12-beta.0 --branch master`：beta runtime dry-run 兼容性通过。

## 发布/部署方式

- 已发布 stable NPM runtime update channel。
- Workflow: `https://github.com/Peiiii/nextclaw/actions/runs/29334981238`
- GitHub Release: `https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.22.4`
- Pages deployment: `https://github.com/Peiiii/nextclaw/actions/runs/29335291761`

## 用户/产品视角的验收步骤

1. 打开旧的 NPM 安装态 NextClaw。
2. 进入运行中的本地服务 UI，或调用 `/api/runtime/update/check`。
3. 旧版本应看到 `0.22.4` 可用更新，而不是继续显示已是最新。
4. 后续正式 NPM 发布若包含 `nextclaw`，必须同时验证 stable runtime manifest 与旧 NPM 安装态检查更新结果。

## 可维护性总结汇总

- 这次不是新增平行发布体系，而是把既有 runtime workflow 暴露为 stable 可复用入口。
- 脚本保留单一 owner，`release:beta:runtime` 与 `release:stable:runtime` 共享同一实现，通过 channel 参数区分。
- 规则落点放在 `npm-release-contract-guard`，因为问题只属于 NPM 包与 NPM runtime channel 发布闭环，不应放入每轮常驻内核大段说明。
- 已同步最小 `AGENTS.md` 命令索引和 `commands/commands.md`，让下次可自动触发正确流程。

## NPM 包发布记录

- 本次未新增发布 NPM package。
- 本次发布的是 NPM runtime update stable channel，对应已发布的 `nextclaw@0.22.4`。
- 后续 stable NPM package 发布若包含 `nextclaw`，发布闭环必须包含 `pnpm release:stable:runtime` 和旧 NPM 安装态检查更新验收。
