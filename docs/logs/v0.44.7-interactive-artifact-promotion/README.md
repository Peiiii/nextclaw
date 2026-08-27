# v0.44.7 聊天内互动成果官网展示

## 迭代完成说明

官网首页的“聊天里的互动成果”已更正为真实 NextClaw 会话录屏，不再把官网自绘滑块当作产品展示。画面中，用户要求做悬臂梁评估，助手在同一条回复里给出内联 Panel App；拖动载荷、长度和安全系数时，位移曲线、最大应力、安全裕度和可用/超限结论同步变化。

根因是前一版把“可交互的视觉效果”错误放在官网本身，而非产品会话里，导致宣传与真实产品能力脱节。修正使用现有聊天内联 Panel App renderer 和公开确定性 fixture 录制，因此画面中的交互路径与产品一致，不是概念图或官网替身。

设计冻结见 [聊天内交互式成果展示设计](../../designs/2026-08-27-interactive-artifact-promotion.design.md)，用户可见变更见 [interactive artifact promotion changeset](../../../.changeset/interactive-artifact-promotion.md)。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/landing tsc` 通过。
- `pnpm --filter @nextclaw/landing build` 通过，产物包含录屏、poster 与 `_headers`。
- 独立截图脚本在运行中的 NextClaw UI 上生成 `10.56s` WebM（约 `656KB`），并以真实会话 iframe 接收三组 range 输入；末帧显示 24.0kN / 3.4m / 2.6 的超限组合，曲线、读数和结论全部改变。
- poster 从 `587KB` PNG 压缩为 `88KB` WebP；中文首屏产品图从 `896KB` PNG 压缩为 `243KB` WebP。
- landing ESLint 无 error；`apps/landing/src/main.ts` 仅保留既有 max-lines warning，本次净减少两行。定向 maintainability guard 无 error。

## 发布/部署方式

- 已在隔离 worktree 提交官网与资产：`c597b6dbc51d60ab4bb5e6c83e12fc6aba5c8edb`（`feat(landing): show interactive results in chat`）。
- 从该候选提交执行 `pnpm deploy:landing`，部署至 Cloudflare Pages 项目 `nextclaw-landing` 的 `master` 分支。
- `https://nextclaw.io/zh/` 已返回新的 `main-P2wsgwGL.js`，其中包含录屏与 poster 引用；正式视频 `200`、约 `529KB`，poster `200`、约 `90KB`。
- 线上响应头确认版本化 WebM、WebP 与 Vite hash 首屏图均为 `Cache-Control: public, max-age=31536000, immutable`；页面 HTML 仍是 `max-age=0, must-revalidate`，以便后续发布立即更新。

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw.io/zh/`，向下浏览到“聊天里的互动成果”。
2. 确认视频画面是完整的 NextClaw 对话，而非官网模拟聊天框：用户请求和助手回复中的“悬臂梁载荷评估”同时可见。
3. 播放或等待循环录屏，确认载荷、长度、安全系数依次变化，曲线、端部挠度、最大应力、安全裕度与“可用/超限”结论同步变化。
4. 在窄屏确认视频等比缩放且原生 controls 可用；视频无法播放时确认同一会话 poster 仍可解释能力。

## 可维护性总结汇总

官网只嵌入真实会话视频与 poster，不再重复实现任何滑块、图表或会话状态。可复现录制归 `scripts/docs/product-screenshots/capture-interactive-engineering-demo.mjs`，公开的 Panel App fixture 归 `fixtures/product-screenshots/`；通用截图器保持不变。没有新增运行时协议、状态持久化或平行展示路径。

定向 maintainability guard 无 error。`main.ts` 保留历史文件预算 warning，但本次未加重；独立录制脚本放入现有产品截图目录，避免扩大通用脚本和目录边界。

## NPM 包发布记录

不涉及 NPM 包发布。本次是官网内容与交互展示更新，由 Cloudflare Pages 独立部署；changeset 用于下一次统一产品发布时保留用户可见记录。
