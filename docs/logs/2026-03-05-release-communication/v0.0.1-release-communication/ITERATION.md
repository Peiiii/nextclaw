# v0.0.1 release-communication

## 迭代完成说明（改了什么）

- 基于已发布版本，新增统一对外发布文案：
  - GitHub Release 正文（`GITHUB_RELEASE.md`）
  - 多渠道宣发文案（`CHANNEL_ANNOUNCEMENTS.md`）
- 版本范围聚焦：
  - `nextclaw@0.9.8`
  - `@nextclaw/ui@0.6.6`
- GitHub Release 已创建：
  - `nextclaw@0.9.7`
  - `nextclaw@0.9.8`（最新）
- 目标：把近期“聊天体验与文档体验优化”集中对外可见，提升传播效率。

## 测试/验证/验收方式

- 发布链路校验：执行 `pnpm release:publish` 并确认成功。
- 版本校验：执行 `npm view nextclaw version` 与 `npm view @nextclaw/ui version`，确认为最新版本。
- GitHub 校验：在仓库 Releases 页面确认 `nextclaw@0.9.8` 公告已创建且内容正确。

## 发布/部署方式

1. 确保版本已完成 NPM 发布。
2. 使用 `GITHUB_RELEASE_0.9.8.md` 作为正式公告正文创建 GitHub Release（tag：`nextclaw@0.9.8`）。
3. 将 `CHANNEL_ANNOUNCEMENTS.md` 用于飞书/社群/公众号等外部渠道分发。

## 用户/产品视角的验收步骤

1. 用户在 GitHub Releases 页面可看到本次版本公告及亮点摘要。
2. 用户在 NPM 可看到对应版本已可安装（`0.9.8` / `0.6.6`）。
3. 外部渠道接收到一致且可复用的发布信息，减少信息割裂。
4. 用户根据公告更新后，可直接感知聊天加载与交互体验优化。
