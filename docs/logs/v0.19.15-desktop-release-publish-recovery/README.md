# v0.19.15 桌面正式发布发布面恢复

## 迭代完成说明

本轮目标是正式发布 `v0.19.26-desktop.1`，并把发布过程中暴露的 workflow 缺口沉淀到可复用规则。

根因一：首次 release-triggered workflow `26330654957` 的五个平台 build/smoke 和 `publish-release-assets` 均通过，但 `publish-desktop-update-channels` 在准备 `gh-pages` worktree 时执行 `git fetch origin gh-pages` 报 `fatal: could not read Username for 'https://github.com': No such device or address`。这说明 release tag checkout 之后，后续 `gh-pages` fetch/push 路径不能隐式依赖 checkout 阶段的凭证状态。

修复一：在 `.github/workflows/desktop-release.yml` 的 `publish-desktop-update-channels` 与 `publish-linux-apt-repo` 两个 `gh-pages` 准备步骤中显式配置 GitHub token 认证，保证 fetch、worktree 与 push 都走同一个可用认证面。

根因二：第二次 workflow_dispatch run `26330908619` 已成功发布 release assets 和 desktop update channels，但 `publish-linux-apt-repo` 在 commit APT 仓库后推送 `.deb` 大文件时失败：`unable to rewind rpc post data`、`HTTP 401`。这说明把 token 嵌入 remote URL 的方式对 APT 大文件 HTTP push 不够稳。

修复二：把 `gh-pages` 认证改为显式 `http.extraheader`，remote URL 保持普通 HTTPS 地址；同时给 APT worktree 配置 `http.postBuffer` 与 `http.version HTTP/1.1`，降低大文件 push 的传输失败概率。

本轮发布恢复原则：已有正式 tag/release 且产品资产已经生成时，不为了修复 downstream publish step 重新发新 tag；应修 workflow 后用 `workflow_dispatch release_tag=v0.19.26-desktop.1` 重跑同一个 release。构建 job 仍 checkout 该 tag，因此桌面产物身份保持不变。

最终恢复结果：第三次 workflow_dispatch run `26331213225` 在 failed-job rerun 后完成，五个平台 build/smoke、`publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功。

同步沉淀：已更新 `.agents/skills/desktop-release-contract-guard/SKILL.md`，新增 existing release recovery、partial release 判断、`gh-pages` 认证与 APT 大文件 push 的明确规则。

## 测试/验证/验收方式

- 已通过本地发布前门禁：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`。
- 已确认 stable launcher floor：`0.0.141`；beta launcher floor：`0.0.143`。
- 已通过首次 release workflow 的五个平台 build/smoke：macOS arm64/x64、Windows x64/arm64、Linux x64。
- 已通过首次 release workflow 的 `publish-release-assets`。
- 已通过第二次 workflow_dispatch run `26330908619` 的 `publish-release-assets` 与 `publish-desktop-update-channels`。
- 已通过第三次 workflow_dispatch run `26331213225`，最终 job 结论全部为 success。
- 已确认 GitHub Release `v0.19.26-desktop.1` 为正式 release，包含 34 个 assets。
- 已确认 `origin/gh-pages` 与公开 Pages 的 stable manifests 均指向 bundle `0.19.26`，`minimumLauncherVersion=0.0.141`。
- 已确认 `origin/gh-pages` 与公开 Pages 的 APT Packages 均包含 `nextclaw-desktop 0.0.189`。
- 已更新官网 landing fallback 到 `v0.19.26-desktop.1 / 0.0.189`，并把 release utils 从 `src` 根目录迁移到 `src/shared`，满足 module-structure 规则。
- 已通过 landing 验证：`pnpm -C apps/landing tsc`、`pnpm -C apps/landing lint`、`pnpm -C apps/landing build`。lint 仅保留 `apps/landing/src/main.ts` 既有超长文件/方法 warning。
- 已执行 workflow 配置 diff 检查：`git diff --check -- .github/workflows/desktop-release.yml`。
- 已执行治理检查：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`。
- 已执行可维护性检查：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts apps/landing/src/shared/desktop-release.utils.ts`，非测试净增 0；仅提示 `apps/landing/src/main.ts` 仍是既有超预算文件。

## 发布/部署方式

- GitHub Release：`v0.19.26-desktop.1`。
- 首次 release-triggered workflow：`26330654957`，失败于 `publish-desktop-update-channels`。
- 第二次 workflow_dispatch：`26330908619`，成功发布 release assets 与 desktop update channels，失败于 `publish-linux-apt-repo` push。
- 最终成功 run：`26331213225`，failed-job rerun 后完成，不创建新 tag。
- 官网 landing fallback 已在 release 完整成功后切到新稳定版。
- 不涉及数据库 migration、后端远程部署或 NPM 包发布。

## 用户/产品视角的验收步骤

1. 打开 GitHub Release `v0.19.26-desktop.1`，确认 macOS、Windows、Linux 安装物和 update bundle/manifest assets 存在。
2. 在 Windows 下载 `NextClaw.Desktop-Setup-0.0.189-x64.exe` 或 portable zip，启动后确认窗口可缩小、标题栏空白区域可拖拽。
3. 在桌面端 stable 更新频道检查更新，确认 manifest 指向 bundle `0.19.26` 且 `minimumLauncherVersion=0.0.141`。
4. 在 Linux 通过 `install-apt.sh` 安装 stable APT 源，确认可安装或升级到 `nextclaw-desktop 0.0.189`。
5. 检查官网/下载页在 GitHub API 不可用时的 fallback 是否指向本次稳定版；若仍指向旧版，需要在 release 闭环完成后单独更新并部署。

## 可维护性总结汇总

本轮属于发布链路修复与规则沉淀，不新增用户功能。实现上没有新增发布脚本或平行流程，而是在既有 `desktop-release.yml` 的 `gh-pages` 发布 owner 内补齐认证与大文件 push 配置；skill 更新把同一类失败抽象成可触发的发布恢复规则，避免下次通过新 tag 掩盖 downstream publish 失败。

官网 fallback 更新触发 module-structure 治理后，顺手把 landing 的 desktop release 工具从 `src` 根目录迁入 `src/shared`，避免继续扩大 root 文件漂移。landing 源码最终非测试净增 0。保留债务是 `apps/landing/src/main.ts` 仍超过文件/方法预算，本轮只移动 import 和 release metadata，不扩大为 landing 拆分重构。

## NPM 包发布记录

不涉及 NPM 包发布。
