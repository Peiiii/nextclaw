# v0.16.96-unified-release-0-18-4

## 迭代完成说明（改了什么）

- 本次迭代用于记录 `nextclaw@0.18.4` 统一 NPM 发版与桌面稳定版 `v0.18.4-desktop.2 / 0.0.147` 的完整发布闭环。
- 已发布统一 NPM 批次，包含 `nextclaw`、`@nextclaw/ui`、`@nextclaw/server`、`@nextclaw/core`、`@nextclaw/ncp`、`@nextclaw/ncp-agent-runtime`、`@nextclaw/ncp-toolkit`、`@nextclaw/kernel` 及同批次相关公开包。
- 发布过程中命中的两个真实阻断：
  - 根因一：`@nextclaw/kernel` 新公开包在当前工作区缺少本地 `node_modules` 链接，导致 `release:check` 的 `tsc` 阶段直接报 `command not found`，不是代码错误而是工作区安装状态未覆盖到该包。
  - 根因二：桌面打包与验包链路仍残留旧 CLI 入口 `dist/cli/index.js`，而当前 `nextclaw` 实际产物已迁到 `dist/cli/app/index.js`；结果是 `ensure-runtime`、bundle manifest、`desktop-package-verify` 的 seed runtime 检查，以及 GitHub Actions 里的 macOS/Linux smoke 脚本都指向了过期路径。
  - 命中根因的修复方式：补一次根目录 `pnpm install` 让 `@nextclaw/kernel` 获得正确的工作区链接；同时把桌面端 runtime 入口引用统一改到 `dist/cli/app/index.js`，覆盖 `ensure-runtime.mjs`、bundle manifest 生成、desktop dev 启动脚本、相关测试、桌面本地验包脚本，以及桌面发布 workflow 使用的 macOS/Linux/Windows smoke 脚本。
- 桌面 release 实际经历了两次 tag：
  - 第一次 `v0.18.4-desktop.1` 对应 workflow `24847499746`，因远端 smoke 仍引用旧入口而失败，没有形成可接受的完整稳定版闭环。
  - 第二次 `v0.18.4-desktop.2` 对应 workflow `24848029793`，四个平台 smoke、release 资产上传、stable update channel 发布与 Linux APT 仓库发布均已成功。
- 新增本次桌面正式版 release note：[`GITHUB_RELEASE.md`](./GITHUB_RELEASE.md)
- 相关设计与功能迭代文档：
  - [`Tool Result Content Items Design`](../../designs/2026-04-23-tool-result-content-items-design.md)
  - [`v0.16.94-tool-result-budget-guard`](../v0.16.94-tool-result-budget-guard/README.md)

## 测试/验证/验收方式

- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm release:check`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
  - 已验证 stable update manifest 验签
  - 已验证 seed bundle version `0.18.4`
  - 已验证 seed runtime `init` 路径 `dist/cli/app/index.js`
  - 已验证 `apps/desktop/release/NextClaw Desktop-0.0.147-arm64.dmg` 的 macOS arm64 安装级 smoke
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm release:verify:published --attempts=12 --delay-ms=5000`
  - 说明：`@nextclaw/kernel@0.1.1` 首发时读路径传播明显慢于写路径，`changeset publish` 后一度出现“发布成功但 `npm view` 仍 404”的短暂窗口；最终 exact version 核验已通过。
- 已通过：`gh run view 24848029793 --repo Peiiii/nextclaw --json status,conclusion,jobs,url`
  - 已确认 `desktop-darwin-arm64`、`desktop-darwin-x64`、`desktop-win32-x64`、`desktop-linux-x64` 全部成功
  - 已确认 `publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功
- 已通过：`gh release view v0.18.4-desktop.2 --repo Peiiii/nextclaw --json assets,isPrerelease,url,name,tagName`
  - 已确认 release 页面挂载 macOS / Windows / Linux 安装包、portable zip、bundle zip、manifest、`latest*.yml` 与 `update-bundle-public.pem`
- 已通过：公开 Pages 与 `origin/gh-pages` 双重抽查
  - `https://Peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-darwin-arm64.json`
  - `https://Peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-linux-x64.json`
  - `origin/gh-pages:desktop-updates/stable/manifest-stable-darwin-arm64.json`
  - `origin/gh-pages:desktop-updates/stable/manifest-stable-linux-x64.json`
  - 以上清单均已确认 `releaseNotesUrl` 与 `bundleUrl` 指向 `v0.18.4-desktop.2`

## 发布/部署方式

- NPM：
  - 先执行 `pnpm release:version`
  - 提交 release commit
  - 再执行 `pnpm release:publish`
  - 若某个首发包只卡在 registry 传播验证，先确认 publish 已被 registry 接收，再补跑 `pnpm release:verify:published`
- Desktop：
  - 推送 release commit 与 package tags
  - 首次创建 GitHub release tag `v0.18.4-desktop.1`，发现远端 smoke 仍残留旧 runtime 入口
  - 修复桌面 smoke 脚本与 landing fallback 后，补发 GitHub release tag `v0.18.4-desktop.2`
  - 等待 `desktop-release` workflow `24848029793` 完成
  - 验证 release assets、`gh-pages` update channel 与 public Pages manifest
- Landing：
  - `apps/landing/src/desktop-release.service.ts` 和四个 HTML 结构化 `downloadUrl` 已更新到新 stable line `v0.18.4-desktop.2`

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw version`，确认线上版本是 `0.18.4`。
2. 运行 `npm view @nextclaw/ui version @nextclaw/server version @nextclaw/core version @nextclaw/ncp version @nextclaw/ncp-agent-runtime version`，确认主链包已切到本次版本。
3. 打开 `https://www.npmjs.com/package/nextclaw`，确认展示 `0.18.4`。
4. 打开桌面正式 release 页面 `https://github.com/Peiiii/nextclaw/releases/tag/v0.18.4-desktop.2`。
5. 下载 macOS arm64 DMG，安装并启动应用。
6. 在桌面端点击“检查更新”，确认不会再因为缺失旧 CLI 入口或 seed runtime 路径失配导致校验链路异常。
7. 当 landing 走 fallback 路径时，确认下载目标落到 `v0.18.4-desktop.2 / 0.0.147`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：基本是。发布阻断修复没有新增额外 fallback，而是统一桌面 runtime 真正的唯一入口路径，并通过一次工作区安装把 `@nextclaw/kernel` 的安装状态拉回正确结构。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次净增长较大，主要来自统一发版自然带来的 changelog、版本文件和已完成但未发布功能的合并交付；发布阻断修复本身仅是极小增量。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。桌面链路修复把本地验包、远端 smoke、bundle manifest 与 landing fallback 全都对齐到同一个真实发布合同，而不是继续让“本地通过一套、CI 走另一套”并行存在。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增发布迭代目录满足要求；功能变更本体沿用现有 package owner 边界。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是，本 README 收尾前已补做独立主观复核。
- 可维护性复核结论：保留债务经说明接受
- 长期目标对齐 / 可维护性推进：本次沿着“统一入口、统一能力编排、统一桌面交付合同”的方向推进了一步。相比继续容忍“源码已对齐但桌面 runtime 和发布验证器还指着旧入口”的状态，这次把 CLI 产物合同、桌面 bundle 合同和稳定下载入口重新收回到同一条路径上。
- 本次顺手减债：是
- 代码增减报告：
  - 新增：3772 行
  - 删除：622 行
  - 净增：3150 行
- 非测试代码增减报告：
  - 新增：3561 行
  - 删除：618 行
  - 净增：2943 行
- 可维护性总结：
  - no maintainability findings
  - 本次净增长很大，但增长主体不是额外叠加的发布补丁，而是此前已经完成但尚未统一发版的一整批公开包源码、版本元数据、changelog 和 `nextclaw` 内置 UI 产物一起进入正式发布快照。
  - 真正为了打通发布链路新增的代码很少，主要就是把桌面侧所有 runtime 入口统一改到唯一真实产物 `dist/cli/app/index.js`，以及补一次工作区安装让 `@nextclaw/kernel` 获得正确的本地依赖链接；这两项都在减少“源码合同”和“发布合同”之间的分叉。
  - 本次补发把之前只在本地修掉的入口合同继续追到了 GitHub Actions smoke 脚本和 landing fallback 元数据，避免再次出现“本地验包通过，但正式 release 仍在远端踩旧路径”的断层。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 已发布包：
  - `nextclaw@0.18.4`
  - `@nextclaw/ui@0.12.12`
  - `@nextclaw/server@0.12.11`
  - `@nextclaw/core@0.12.11`
  - `@nextclaw/ncp@0.5.5`
  - `@nextclaw/ncp-agent-runtime@0.3.15`
  - `@nextclaw/ncp-toolkit@0.5.10`
  - `@nextclaw/kernel@0.1.1`
  - 以及同批次 channel/runtime/bridge/remote/compat 相关公开包
- 特殊说明：
  - `@nextclaw/kernel@0.1.1` 在 `changeset publish` 后经历了较长 registry 读路径传播窗口，导致首次 `release:verify:published` 误判失败；经再次核验后已确认 published。
- 阻塞与触发条件：
  - 无剩余 NPM 发包阻塞；桌面 release、stable update channel 与 Linux APT 仓库也已完成远端发布。
