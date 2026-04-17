# v0.16.44-nextclaw-0-18-hermes-bridge-release

## 迭代完成说明

本次完成了 `nextclaw` 新一轮正式 NPM 发布，并把 Hermes ACP bridge 抽离后的新 runtime 交付面一起推上 registry。

- `nextclaw` 按用户要求完成 minor 升版，从 `0.17.12` 发布到 `0.18.0`。
- 新增并发布了独立包 `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`，把原先散落在通用 stdio runtime 内的 Hermes ACP bridge 能力收敛成可复用、可独立依赖的 runtime 包。
- 同步发布了与本次变更直接相关的包：
  - `@nextclaw/core@0.12.8`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`
- 因内部依赖链联动，本次发布链路还一并推送了自动进入批次的相关公开包，最终 registry 校验通过 `22/22` 个版本。
- 基于上述 `nextclaw 0.18.0` 交付，本次还完成了桌面预览 beta 发布：GitHub prerelease `v0.18.0-desktop-beta.1`，release title 为 [NextClaw Desktop 0.0.143 Preview Beta 1](https://github.com/Peiiii/nextclaw/releases/tag/v0.18.0-desktop-beta.1)。
- 本次桌面 prerelease 对应 launcher `0.0.143`，内置 product bundle `0.18.0`；四个平台 release assets、beta update manifests 与 `update-bundle-public.pem` 已全部发布完成。
- 桌面发布过程中遇到一次非代码型 CI 坑：`desktop-darwin-arm64` 在 attempt 1 的 `actions/upload-artifact@v4` 阶段报 `Upload progress stalled.`；attempt 2 通过 `rerun failed jobs` 收敛成功，对应防坑要点已补到 [desktop-release-contract-guard](../../../.agents/skills/desktop-release-contract-guard/SKILL.md)。

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm release:version
pnpm release:publish
npm view nextclaw version
npm view @nextclaw/nextclaw-hermes-acp-bridge version
npm view @nextclaw/nextclaw-ncp-runtime-stdio-client version
pnpm -C apps/desktop lint
pnpm -C apps/desktop tsc
pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/session-search/session-search-feature.service.test.ts src/cli/commands/ncp/session-search/session-search-runtime.service.test.ts src/cli/commands/ncp/session/nextclaw-ncp-tool-registry.session-search.test.ts
pnpm -C packages/nextclaw build
PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify
gh run view 24565083498 --repo Peiiii/nextclaw --json status,conclusion,jobs,url,attempt
gh release view v0.18.0-desktop-beta.1 --repo Peiiii/nextclaw --json assets,isPrerelease,url
gh api 'repos/Peiiii/nextclaw/contents/desktop-updates/beta/manifest-beta-darwin-arm64.json?ref=gh-pages' --jq .content | tr -d '\n' | base64 --decode
```

结果：

- `release:version` 成功生成版本号与 CHANGELOG。
- `release:publish` 成功完成发布、tag 与 registry 校验；最终结果为 `published 22/22 package versions`。
- 外部抽样确认：
  - `nextclaw@0.18.0`
  - `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`
- 桌面本地验证全部通过：
  - `apps/desktop lint`
  - `apps/desktop tsc`
  - `packages/nextclaw build`
  - 三条 `session-search` 定向测试
  - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
- `desktop:package:verify` 本地结果已覆盖：
  - `update manifest signature verified`
  - `seed bundle version verified: 0.18.0`
  - `seed runtime init verified`
  - `macOS package verified: .../apps/desktop/release/NextClaw Desktop-0.0.143-arm64.dmg`
- 远端桌面发布 workflow [24565083498](https://github.com/Peiiii/nextclaw/actions/runs/24565083498) 最终为 `attempt 2 / success`：
  - 四个平台构建 job 成功：`desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-linux-x64`、`desktop-win32-x64`
  - 后续发布 job 成功：`publish-release-assets`、`publish-desktop-update-channels`
  - `publish-linux-apt-repo` 因 beta 渠道被正确跳过
- prerelease 已确认上传桌面资产、bundle、manifest、公钥等完整文件集合。
- `gh-pages` 分支已确认发布到 commit `c1876e303f918999bc4aad15d4dc8c599b28f13e`；该分支上的 beta manifest 已切到 `0.18.0 / 0.0.143`。GitHub Pages 对外地址存在短暂 CDN 传播窗口，属于平台侧延迟，不是 workflow 失败。

## 发布 / 部署方式

本次已完成正式 NPM 发布与桌面 preview beta 发布。

本次核心交付版本如下：

1. `nextclaw@0.18.0`
2. `@nextclaw/core@0.12.8`
3. `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`
4. `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`
5. `NextClaw Desktop launcher@0.0.143`
6. `NextClaw Desktop bundle@0.18.0`

桌面发布入口：

- prerelease 页面：[v0.18.0-desktop-beta.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.18.0-desktop-beta.1)
- workflow run：[desktop-release #24565083498](https://github.com/Peiiii/nextclaw/actions/runs/24565083498)
- beta update channel source：`gh-pages` 分支 `desktop-updates/beta/*`，本次发布 commit 为 `c1876e303f918999bc4aad15d4dc8c599b28f13e`

后续使用时：

- NPM 用户直接安装上述正式包版本。
- 桌面预览用户直接从 prerelease 下载对应平台资产，或使用桌面内的 beta 更新通道拉取 `0.18.0`。

## 用户 / 产品视角的验收步骤

1. 在任意干净目录执行 `npm view nextclaw version`，确认输出 `0.18.0`。
2. 执行 `npm view @nextclaw/nextclaw-hermes-acp-bridge version`，确认新 bridge 包已可见。
3. 执行 `npm view @nextclaw/nextclaw-ncp-runtime-stdio-client version`，确认 stdio runtime 新版本已可见。
4. 打开 [v0.18.0-desktop-beta.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.18.0-desktop-beta.1)，确认可见 macOS arm64/x64、Windows x64、Linux x64 的桌面资产，以及四个平台对应的 `nextclaw-bundle-*.zip`、`manifest-beta-*.json`、`update-bundle-public.pem`。
5. 在任意一台已安装桌面预览版且走 beta 渠道的机器上执行一次“检查更新”，预期应指向 `0.18.0` bundle；如 GitHub Pages 公网地址尚未刷新到新 manifest，等待传播窗口结束后重试即可。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次发布不是单纯抬版本号，而是把 Hermes ACP bridge 从通用 stdio runtime 中独立出来后，真正收敛成对外可安装、可复用、可依赖的稳定交付面。这比继续把 Hermes 特例藏在通用 runtime 内，更符合 NextClaw 作为统一入口与能力编排层的长期方向。

桌面侧也不是单纯“把包传上去”就结束，而是补齐了本地验签验证、远端四平台资产上传、beta update manifests 发布，以及一次真实踩坑后的发布防坑文档沉淀。这让桌面交付更接近“可验证的统一操作层发布”，而不是一次性的人肉发版。

### 可维护性复核结论

不适用。

原因：本次补充主要是 release 收尾、结果留痕与 skill 治理，没有新增产品功能代码；源代码层面的可维护性评估仍应归属到对应功能迭代，而不是在本次统一 release 记录里重复展开。

### 本次顺手减债

是。

- 把 `nextclaw 0.18.0` 与 Hermes ACP bridge 新包交付收敛到正式 registry。
- 避免“仓库代码已经切到新 runtime 边界，但外部用户仍拿不到对应包版本”的交付割裂。
- 把桌面 beta 发布结果、workflow run、update channel 状态与一次真实踩坑处理统一收敛到同一迭代记录。
- 没有额外新增发布脚本，而是把经验沉淀到既有 skill，避免以后重复踩同一类流程坑。

### 代码增减报告

- 不适用：本次补充仍以发布闭环和流程留痕为主，不单独评价功能代码增量。

### 非测试代码增减报告

- 有小幅净增长，但属于最小必要：仅补充迭代 README 与现有桌面发布 skill，没有新增运行时代码、发布脚本或新的流程分支。

### 删减优先 / 简化优先判断

是。

本次仍复用既有 `changesets + release scripts` 链路完成发布，没有再引入临时手工发版脚本或额外发布通道。

桌面侧同样复用既有 `desktop-release` workflow 与本地 `desktop:package:verify` 验证链路完成收尾；面对 CI 上传卡死，优先使用 `rerun failed jobs` 收敛，而不是立刻叠加临时发布路径。

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

总体可接受。

- 本次没有为了发版新增新的发布工具层。
- 文件变化主要集中在版本号、CHANGELOG、发布记录与 skill 规则沉淀，属于发布闭环的最小必要同步。

### 抽象与职责边界判断

更清晰。

- Hermes ACP bridge 现在有了独立公开包边界，不再只是通用 stdio runtime 内部的一块隐式特化逻辑。
- 发布链路仍由既有 release scripts、desktop workflow 与现有 release guard 统一承接，没有新增第二套流程。

### 目录结构与文件组织判断

满足当前项目治理要求。

- 本次迭代记录按 `docs/logs/v<semver>-<slug>/README.md` 规范新增。
- 本次续改继续合并在既有迭代目录中，没有额外拆出细碎 release 目录。
- 未新增额外发布脚本目录或临时发布资产目录。
