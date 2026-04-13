# v0.16.10 Landing Desktop Release Sync

## 迭代完成说明（改了什么）

- 更新 landing 页桌面下载兜底元数据 [`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts)，把旧正式版 `v0.13.24-desktop.5 / 0.0.60` 对齐到当前最新正式版 `v0.17.8-desktop.1 / 0.0.136`。
- 四个平台兜底下载地址已统一切换到当前正式 release 资产：
  - `NextClaw.Desktop-0.0.136-arm64.dmg`
  - `NextClaw.Desktop-0.0.136-x64.dmg`
  - `NextClaw.Desktop-0.0.136-win32-x64-unpacked.zip`
  - `NextClaw.Desktop-0.0.136-linux-x64.AppImage`
- 更新四个 landing HTML 的结构化 `downloadUrl`，避免 SEO / 分享抓取继续命中旧 release：
  - [`apps/landing/en/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/en/index.html)
  - [`apps/landing/en/download/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/en/download/index.html)
  - [`apps/landing/zh/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/zh/index.html)
  - [`apps/landing/zh/download/index.html`](/Users/peiwang/Projects/nextbot/apps/landing/zh/download/index.html)
- 线上 release 核对结果：
  - 正式 release tag：`v0.17.8-desktop.1`
  - 发布时间：`2026-04-12T17:56:12Z`
  - release 页面：`https://github.com/Peiiii/nextclaw/releases/tag/v0.17.8-desktop.1`
  - `v0.17.10-desktop-beta.2` 为 pre-release，本次未作为官网默认下载目标

## 测试 / 验证 / 验收方式

- 线上 release 核对：
  - `gh release view v0.17.8-desktop.1 --repo Peiiii/nextclaw --json tagName,name,isPrerelease,url,publishedAt`
  - `gh release view v0.17.8-desktop.1 --repo Peiiii/nextclaw --json assets --jq '.assets[].name' | rg 'NextClaw\\.Desktop-0\\.0\\.136-(arm64|x64)\\.dmg|NextClaw\\.Desktop-0\\.0\\.136-win32-x64-unpacked\\.zip|NextClaw\\.Desktop-0\\.0\\.136-linux-x64\\.AppImage'`
  - 结果：确认 `v0.17.8-desktop.1` 是线上最新正式桌面 release，且四个平台资产齐全。
- 源码 / 静态页校验：
  - `rg -n "v0\\.17\\.8-desktop\\.1|0\\.0\\.136" apps/landing/src/main.ts apps/landing/en/index.html apps/landing/en/download/index.html apps/landing/zh/index.html apps/landing/zh/download/index.html`
  - 结果：命中最新正式版 tag 与版本号。
- 构建验证：
  - `pnpm -C apps/landing build`
  - 结果：通过。
- 定向 lint / 类型检查：
  - `pnpm -C apps/landing lint`
  - 结果：通过，无 error；保留既有 warning：[`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts) 超长文件与超长 `render` 方法，本次未新增该债务。
  - `pnpm -C apps/landing tsc`
  - 结果：通过。
- 预览冒烟：
  - `pnpm -C apps/landing preview --host 127.0.0.1 --port 4173`
  - `curl -s http://127.0.0.1:4173/en/download/ | rg 'v0\\.17\\.8-desktop\\.1'`
  - `curl -s http://127.0.0.1:4173/zh/download/ | rg 'v0\\.17\\.8-desktop\\.1'`
  - `curl -s http://127.0.0.1:4173/assets/main-BHiX-fzm.js | rg 'v0\\.17\\.8-desktop\\.1|0\\.0\\.136'`
  - 结果：预览输出与打包 JS 都已切到 `v0.17.8-desktop.1 / 0.0.136`。
- 维护性守卫：
  - `pnpm lint:maintainability:guard`
  - 结果：未通过。
  - 原因：被工作区内其它并行改动的既有治理问题阻断，不是本次 landing 链接更新触发的新错误；本次触达文件只保留既有 `apps/landing/src/main.ts` 超长 warning。

## 发布 / 部署方式

- 合并当前改动后，可执行 `pnpm deploy:landing` 发布最新 landing 到 Cloudflare Pages。
- 本次不涉及桌面二进制重发，不涉及 npm publish，也不涉及数据库或服务端迁移。

## 用户 / 产品视角的验收步骤

1. 打开 landing 首页或下载页，确认当前桌面版版本号显示为 `0.0.136`。
2. 点击 release 链接，确认跳转到 `v0.17.8-desktop.1`，而不是旧的 `v0.13.24-desktop.5`。
3. 在 macOS Apple Silicon / Intel 下载卡片上，确认分别落到 `NextClaw.Desktop-0.0.136-arm64.dmg` 与 `NextClaw.Desktop-0.0.136-x64.dmg`。
4. 在 Windows 与 Linux 下载卡片上，确认分别落到 `NextClaw.Desktop-0.0.136-win32-x64-unpacked.zip` 与 `NextClaw.Desktop-0.0.136-linux-x64.AppImage`。
5. 即使浏览器没有成功拉到 GitHub API 动态元数据，也应因为 fallback 已更新而继续下载到 `v0.17.8-desktop.1` 的正式资产，而不是旧版。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次只更新已有下载元数据与结构化地址，没有引入新的下载配置层、条件分支或额外封装。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。方案保持原有“运行时拉最新正式版 + 静态 fallback 兜底”的单一路径，只替换过期常量，不叠加新逻辑。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。未新增源代码文件、未新增函数、未新增分支；本次变更总计 `新增 11 行 / 删除 11 行 / 净增 0 行`，非测试代码净增同样为 `0`。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。下载入口仍由 landing 现有 owner 集中维护，没有把 release 同步再拆成新 helper 或 patch 层。
- 目录结构与文件组织是否满足当前项目治理要求：本次未新增目录治理债务。已知历史债务是 [`apps/landing/src/main.ts`](/Users/peiwang/Projects/nextbot/apps/landing/src/main.ts) 仍然过长，但这不是本次引入，也没有继续恶化；下一步整理入口仍是把该文件按页面区块与渲染职责继续拆分。
- 基于独立于实现阶段的 `post-edit-maintainability-review` 复核结论如下：
  - 可维护性复核结论：通过
  - 本次顺手减债：否
  - 长期目标对齐 / 可维护性推进：
    - 这次改动顺着“统一入口的官方下载入口必须稳定可信”的长期方向前进了一小步，避免用户被官网带去旧版 release。
    - 本次没有新增功能，重点是把旧 release 常量收回到当前正式版，维持“动态拉取失败时也不掉到过期版本”的可预测行为。
  - 代码增减报告：
    - 新增：11 行
    - 删除：11 行
    - 净增：0 行
  - 非测试代码增减报告：
    - 新增：11 行
    - 删除：11 行
    - 净增：0 行
  - no maintainability findings
  - 可维护性总结：
    - 这次修改没有增加任何新抽象，只把过期元数据替换为当前正式版，保持了现有下载链路的简单性。
    - 已知债务仍是 landing 主文件过长，但本次没有继续放大它；后续若继续动 landing，可把下载页与首页渲染继续拆到更清晰的 owner 边界中。
