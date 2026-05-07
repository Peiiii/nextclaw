# v0.16.18-unified-release-0-17-11

## 迭代完成说明（改了什么）

- 完成一次新的统一 NPM 发布批次，并将公开包统一推进到新版本：
  - `nextclaw@0.17.11`
  - `@nextclaw/ui@0.12.8`
  - `@nextclaw/server@0.12.6`
  - `@nextclaw/core@0.12.6`
  - `@nextclaw/ncp@0.5.1`
  - `@nextclaw/ncp-toolkit@0.5.6`
  - 以及同批次存在未发布漂移的公开扩展包、agent chat 包、runtime 相关包，共 `35` 个公开包版本。
- 将桌面端正式发布线从旧 stable `v0.17.8-desktop.1 / 0.0.136` 对齐到新 stable：
  - 新桌面正式 release tag：`v0.17.11-desktop.1`
  - 新桌面 launcher 版本：`0.0.140`
  - 新桌面 bundle 版本：`0.17.11`
- 更新 landing 页桌面下载 fallback：
  - 将 [`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts) 中的 `DESKTOP_RELEASE_FALLBACK` 从 `v0.17.8-desktop.1 / 0.0.136` 切到 `v0.17.11-desktop.1 / 0.0.140`，避免 GitHub API 不可用时继续回退到旧正式版。
- 补齐并纠正 GitHub Release 正文：
  - 将本次桌面正式版 release note 修正为双语双区块格式，恢复仓库既有规范：`English Version` 在前，`中文版` 在后。
  - 新增本次实际发布正文：[github-release.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.18-unified-release-0-17-11/github-release.md)
  - 新增可复用模板：[github-release-template.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.18-unified-release-0-17-11/github-release-template.md)
  - 本次也顺手清掉了当前线上 release note 中重复四次的 `Full Changelog` 噪音。
- 顺手修掉三个真实阻断发布链路的问题：
  - 将 [`scripts/release/release-scope.mjs`](/Users/peiwang/Projects/nextbot/scripts/release/release-scope.mjs) 的 `prepublishOnly` 预期路径从旧的 `scripts/ensure-pnpm-publish.mjs` 对齐到当前真实路径 `scripts/release/ensure-pnpm-publish.mjs`，否则 `release:check:groups` 会持续假失败。
  - 删除 [`packages/nextclaw-core/src/providers/openai_provider.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/providers/openai_provider.ts) 中未使用的 `ToolCallRequest` 导入，解除本次 strict release check 的第一处真正 error。
  - 将 [desktop-release.yml](/Users/peiwang/Projects/nextbot/.github/workflows/desktop-release.yml) 中 Linux APT 发布阶段的 `.deb` 收集从仅扫描 `dist/desktop-release` 顶层，改为递归扫描整个 artifact 展开目录；否则 rerun 虽然已经产出 `0.0.140` 的 Linux deb，也不会被复制进 APT 仓库输入，最终 stable APT repo 只会停留在旧版本。
- 本次用户可感知更新点主要来自此前已完成但尚未统一发版的一批能力与修复，包括：
  - Desktop / Web 统一 `Service Management` 与运行时重启控制
  - Desktop presence lifecycle v1：关窗后台驻留、托盘恢复、登录自启、显式退出语义
  - Desktop 更新打包合同加固：包内公钥、seed bundle、manifest 验签、自愈与恢复链路
  - 会话已读状态持久化、首次发送路由与草稿/会话同步修复
  - provider 默认模型切换 fallback 修复
  - Hermes learning loop P0 协议接入

## 测试/验证/验收方式

- NPM 发布前标准校验已通过：
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:check`
  - 结果：通过。
- NPM 发布前严格校验已执行但未作为最终阻断：
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:check:strict`
  - 结果：未完全通过。
  - 说明：`@nextclaw/agent-chat-ui` 暴露了历史存量 lint error，不属于本次统一发版新增问题；仓库正式发布脚本本身使用的是 `release:check` 而不是 strict lint gate，因此本次按正式发布合同继续。
- landing 兜底元数据已编译验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/landing build`
  - 结果：通过。
- 桌面正式更新合同本地验证已通过：
  - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
  - 结果：
    - 新 DMG 产物：`apps/desktop/release/NextClaw Desktop-0.0.140-arm64.dmg`
    - 包内公钥可真实验证线上 stable manifest 签名
    - seed bundle version 已验证为 `0.17.11`
    - seed runtime `init` 验证通过
    - DMG 安装级 smoke 通过
- 桌面远端正式发布工作流最终已全绿闭环：
  - `desktop-release` rerun：`24401769943`
  - 结果：`publish-release-assets`、`publish-desktop-update-channels`、`publish-linux-apt-repo` 全部成功。
  - APT 发布证据：
    - 日志明确写入 `create mode 100644 apt/pool/main/n/nextclaw-desktop/nextclaw-desktop_0.0.140_amd64.deb`
    - `Smoke Linux APT fresh install` 通过
    - `Smoke Linux APT upgrade` 通过，并验证 `Unpacking nextclaw-desktop (0.0.140) over (0.0.134)`
- 维护性守卫已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：未完全通过。
  - 说明：
    - maintainability report 只有 warning，没有本次新增 error。
    - diff-only governance 因触碰历史 legacy 文件 [`packages/nextclaw-core/src/providers/openai_provider.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/providers/openai_provider.ts) 而命中 kebab-case 命名阻断；本次未继续扩 scope 做整组 legacy provider 文件重命名。

## 发布/部署方式

- 已执行统一 NPM 发布：
  - `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
  - 结果：`35/35` 个批次包已在 `https://registry.npmjs.org/` 上可见。
- 已推送 release commit 与 package tags：
  - `git push origin master --follow-tags`
  - 当前 release commit：`19eb364edcc272f0de025bcdd913b6b1407536c1`
- 已创建桌面正式 release：
  - `gh release create v0.17.11-desktop.1 --repo Peiiii/nextclaw ...`
  - release 页面：`https://github.com/Peiiii/nextclaw/releases/tag/v0.17.11-desktop.1`
  - 发布时间：`2026-04-14T12:46:23Z`
  - 结果：`isPrerelease=false`
  - release note 已更新为双语双区块正式说明，并对齐到 [github-release.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.18-unified-release-0-17-11/github-release.md)
- 桌面远端工作流：
  - 首次失败 run：`24400918045`
  - 闭环 rerun：`24401769943`
  - 工作流：`desktop-release`
  - 用途：产出 macOS / Windows / Linux 安装包、bundle、manifest、稳定通道更新资产以及 Linux APT 仓库。
  - 说明：首次失败 run 已完成桌面 release assets 与稳定通道更新，但 APT publish 因 artifact 目录扫描只看顶层而未纳入 `0.0.140`；修复后 rerun 已补齐 APT repo 正式发布。

## 用户/产品视角的验收步骤

1. 运行 `npm view nextclaw version`，确认线上版本已是 `0.17.11`。
2. 执行 `npm view @nextclaw/ui version @nextclaw/server version @nextclaw/core version`，确认主链包版本分别为 `0.12.8 / 0.12.6 / 0.12.6`。
3. 打开 NPM 包页面 `https://www.npmjs.com/package/nextclaw`，确认展示的是 `0.17.11`。
4. 打开桌面正式 release 页面 `https://github.com/Peiiii/nextclaw/releases/tag/v0.17.11-desktop.1`。
5. 确认 release 不是 pre-release，并且 release note 为双语双区块格式：先 `English Version`，再 `中文版`。
6. 下载桌面端安装包后打开应用，进入运行时配置页，确认新的 `Service Management` / `Runtime Presence` 能力仍可用。
7. 在桌面端点击“检查更新”，确认不会再出现缺少 `bundlePublicKey` 的更新验签错误。
8. 当 landing 走 fallback 路径时，确认下载目标落到 `v0.17.11-desktop.1 / 0.0.140`，而不是旧的 `v0.17.8-desktop.1 / 0.0.136`。
9. 在 Linux 环境按 `install-apt.sh` 安装 stable APT 源后执行 fresh install，确认可安装 `nextclaw-desktop 0.0.140`。
10. 在已装旧版 `0.0.134` 的 Linux 环境执行 `apt upgrade`，确认可升级到 `0.0.140`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：基本是。本次以版本对齐、changelog 与发布闭环为主，功能代码层面只接受了三个最小必要修复：发布脚本路径对齐、一个未使用导入删除，以及 Linux APT 发布阶段的递归收包修复，没有顺势扩成大规模重构。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：未做到净删除。此次提交总计新增 `1725` 行、删除 `47` 行，净增 `+1678` 行；非测试代码同样为新增 `1725` 行、删除 `47` 行、净增 `+1678` 行。增长几乎全部来自 release changelog 与版本文件更新，属于统一发版天然的元信息成本，而不是新增业务实现层。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。真正涉及逻辑的改动只落在发布范围判断、lint 清理与 Linux APT 收包修复三个点，没有再额外长出新的发布 helper、兼容分支或绕过逻辑。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。此次显式触碰到的 [`packages/nextclaw-core/src/providers/openai_provider.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/providers/openai_provider.ts) 仍是历史 legacy 命名文件，因此 `lint:new-code:governance` 会阻断；本次未继续把范围扩成 provider 目录整批重命名迁移。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。
- 可维护性复核结论：保留债务经说明接受。
- 本次顺手减债：是。除了把 `release:check:groups` 的旧路径合同修正到当前脚本目录结构外，还去掉了 Linux APT 发布对 artifact 顶层结构的脆弱假设，改成递归收集 `.deb`，避免以后 rerun 再次出现“构建成功但 APT 仓库漏包”的假闭环。
- 长期目标对齐 / 可维护性推进：本次顺着“让统一发布链路更可预测、更少 surprise failure”的方向推进了一小步。虽然没有减少 changelog 造成的元信息膨胀，但至少把真正阻断发布的历史假错误收掉了，并把 stable 桌面入口、NPM registry、landing fallback、desktop update channels、Linux APT repo、GitHub release note 六条发布面重新拉回一致。
- 可维护性总结：这次是典型的发布闭环批次，代码增长主要是版本与 changelog 元数据，业务复杂度几乎没有继续上升。保留的主要债务是 strict lint 存量错误、legacy 文件命名迁移，以及 APT 仓库的大文件仍在 `gh-pages` 直接托管；本轮已顺手把 GitHub release 双语结构从“隐含约定”前移为可复用模板。下一步最值得单独开批次处理的是 `@nextclaw/agent-chat-ui` 的 strict lint 清债、`providers/` 目录的 legacy kebab-case 迁移，以及 Linux 安装物分发承载策略。
