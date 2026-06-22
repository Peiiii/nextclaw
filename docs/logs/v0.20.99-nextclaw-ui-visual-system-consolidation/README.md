# v0.20.99 NextClaw UI Visual System Consolidation

## 迭代完成说明

本轮从“新增主题”推进到“主题色分配和界面整体设计感收敛”。原界面主要问题不是颜色过多，而是背景、卡片、控件、输入栏、弹窗等高频界面骨架大量绕过语义 token，导致主题只能局部生效，整体视觉层级不够清晰。

目标从新增主题进一步收敛为简约主题体系：新增接近早期产品截图的 `natural` 默认主题，采用暖灰侧栏、近白主画布和低饱和橄榄主动作，同时保留接近 OpenAI / ChatGPT 气质的 `minimal` 纯黑白灰备选主题，移除不舒适的绿色主轴，新增低饱和的 `dawn`、`graphite` 主题，保留并降噪 `probe`，把聊天首页首屏、历史工具会话、Provider 设置、DocBrowser 和 Side Dock 应用面板这些代表性工作区统一到设计 token 合同下。

## 2. 方案与原则

新增方案文档：

- `docs/designs/2026-06-20-nextclaw-ui-visual-system-consolidation.design.md`

核心原则：

- 背景色负责整体气质，不承担交互强调。
- `card` 只用于承载内容，不能继续散落硬编码白色。
- `muted` 负责次级面和低强调控件。
- `accent` 负责 hover、轻选中和图标底色。
- `primary` 只用于主动作、品牌感和关键状态。
- 图片参考中的金色、紫色只作为插画和状态点缀，不进入常规 UI 主色。
- 主题不以绿色为主轴；主色保持低饱和，只做操作锚点。
- 会话 header 与底部输入区上方的装饰性横线移除，避免把对话流切碎。
- 消息卡片、工具调用卡片、附件卡片、inline panel card 属于主题管辖范围；组件不再用固定 amber/slate/gray 自建视觉体系，只有错误、运行、成功、diff 增删等状态继续保留语义色。

## 3. 实现范围

本轮完成：

- 新增 `natural`、`minimal`、`dawn`、`graphite`、`probe` 主题枚举、i18n 文案、初始化脚本、PWA shell theme color，并将无本地主题存储时的默认值改为 `natural`。
- 将旧 `leaf` 存储值迁移到 `warm`，并从可选主题中移除。
- 以低饱和工作台最佳实践重建 `natural` / `minimal` / `warm` / `cool` / `dawn` / `graphite` / `probe` token。
- 将聊天首页主画布、侧栏工具栏、欢迎页、输入栏、下拉、弹窗、基础按钮、卡片、tabs、switch、dialog 等高频 UI 从固定白/灰收敛到语义 token。
- 将历史会话列表、项目徽标、设置页 split pane、Provider 列表和详情表单、DocBrowser 壳层、Panel Apps / Service Apps 面板从固定白/灰收敛到语义 token。
- 将 agent chat UI 默认皮肤同步 token 化，避免输入栏成为跨包视觉断点。
- 将工具调用卡片、消息头像、inline token、附件卡片和 inline panel card 的壳层色收敛到 `card/muted/accent/border/foreground/primary-foreground`，避免历史工具会话中出现固定黄色或固定 slate 卡片。
- 将 theme 模块内部状态收敛到 `UiThemeOwner`，保留原导出函数作为兼容门面。
- 移除会话 header 下边线、父会话 banner 下边线、默认输入栏外壳上边线，并更新 header 测试不再把 `border-b` 当结构锚点。
- 将 `probe` 主动作色从蓝绿色/靛蓝方向收敛为参考图标题与机器人描边的深墨色，并同步调整探针主题 hover 边界与浅选中底色，避免主色和米黄色纸面冲突。
- 将默认主题从 `minimal` 调整为 `natural`，恢复最早产品截图的暖灰工作台气质；header 继续只使用普通工作区背景，不做特殊主题色块。
- 将自然主题下的会话列表选中态从 `accent` 色面恢复为改动前的中性灰阶列表选中态，并将自然主题根灰阶恢复到旧代码实际落色：`--gray-200: 45 14% 88%`、`--gray-900: 45 5% 12%`，避免同一 `bg-gray-200` class 在新主题下落成偏绿灰。

## 测试/验证/验收方式

已通过：

- `pnpm -C packages/nextclaw-ui run tsc --pretty false`
- `pnpm -C packages/nextclaw-agent-chat-ui run tsc --pretty false`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/pwa/managers/__tests__/pwa-shell-theme.manager.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-header.test.tsx`
- `pnpm -C packages/nextclaw-ui exec vitest run src/app/components/layout/__tests__/sidebar.layout.test.tsx src/shared/components/__tests__/config-split-page.test.tsx src/shared/components/doc-browser/__tests__/doc-browser.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx src/features/side-dock/components/__tests__/side-dock.test.tsx`
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/panel-apps/components/__tests__/panel-apps-list.test.tsx src/features/panel-apps/components/__tests__/panel-app-list-item.test.tsx src/features/panel-apps/components/__tests__/panel-app-toolbar.test.tsx src/features/service-apps/components/__tests__/service-apps-panel.test.tsx src/features/side-dock/components/__tests__/side-dock.test.tsx src/shared/components/doc-browser/__tests__/doc-browser.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-selection.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.generic-tool.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.terminal.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.attachments.test.tsx src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx`
- `pnpm -C packages/nextclaw-ui run lint`
- `pnpm -C packages/nextclaw-agent-chat-ui run lint`
- `pnpm -C packages/nextclaw-agent-chat-ui run build`
- `pnpm -C packages/nextclaw-ui run build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm clean:generated`

## 用户/产品视角的验收步骤

视觉验收：

- 浏览器打开 `http://127.0.0.1:5174/chat` 与 `http://127.0.0.1:5174/providers`。
- Probe 主题首页截图：`/tmp/nextclaw-probe-clean-home.png`。
- Probe 主题历史工具会话截图：`/tmp/nextclaw-probe-clean-history-tool.png`。
- Probe 主题 Provider 设置页截图：`/tmp/nextclaw-probe-clean-providers.png`。
- Probe 主题 DocBrowser 截图：`/tmp/nextclaw-probe-clean-docbrowser.png`。
- Probe 主题 Side Dock 应用面板截图：`/tmp/nextclaw-probe-clean-sidedock-apps.png`。
- 本轮 follow-up 重新截图：
  - 纸暖首页：`/tmp/nextclaw-after-warm-chat.png`
  - 雾蓝首页：`/tmp/nextclaw-after-cool-chat.png`
  - 晨砂首页：`/tmp/nextclaw-after-dawn-chat.png`
  - 石墨首页：`/tmp/nextclaw-after-graphite-chat.png`
  - 探针首页：`/tmp/nextclaw-after-probe-chat.png`
  - 纸暖历史工具会话：`/tmp/nextclaw-after-warm-history-tool.png`
  - 纸暖 Provider 设置页：`/tmp/nextclaw-after-warm-providers.png`
  - 纸暖 DocBrowser：`/tmp/nextclaw-after-warm-docbrowser.png`
  - 纸暖 Side Dock 应用面板：`/tmp/nextclaw-after-warm-sidedock-apps.png`
  - 纸暖 Side Dock 服务应用面板：`/tmp/nextclaw-after-warm-sidedock-service-apps.png`
  - 简白首页：`/tmp/nextclaw-minimal-default-chat-themed-cards.png`
  - 简白历史工具会话：`/tmp/nextclaw-minimal-history-tool-themed-cards.png`
  - 简白 Provider 设置页：`/tmp/nextclaw-minimal-providers-themed-cards.png`
  - 简白 DocBrowser：`/tmp/nextclaw-minimal-docbrowser-themed-cards.png`
  - 简白 Side Dock 应用面板：`/tmp/nextclaw-minimal-sidedock-apps-themed-cards.png`
  - 简白 Side Dock 服务应用面板：`/tmp/nextclaw-minimal-sidedock-service-apps-themed-cards.png`
  - 默认自然首页：`/tmp/nextclaw-natural-default-chat.png`
  - 默认自然历史工具会话：`/tmp/nextclaw-natural-history-tool.png`
  - 默认自然 Provider 设置页：`/tmp/nextclaw-natural-providers.png`
  - 默认自然 DocBrowser：`/tmp/nextclaw-natural-docbrowser.png`
  - 默认自然 Side Dock 应用面板：`/tmp/nextclaw-natural-sidedock-apps.png`
  - 默认自然 Side Dock 服务应用面板：`/tmp/nextclaw-natural-sidedock-service-apps.png`
  - 默认自然会话列表选中态恢复：`/tmp/nextclaw-natural-session-selected-old-colors.png`

## 可维护性总结汇总

可维护性 guard 结果：

- Errors: 0
- Warnings: 10
- Total line changes: `+752 / -607 / net +145`
- Non-test line changes: `+667 / -588 / net +79`

warning 均为既有预算或接近预算压力，本轮没有继续增加对应文件行数或目录文件数：

- `chat-input-bar.test.tsx` 接近 900 行预算，当前 862 行，本轮净增 0。
- `chat-message-list.test.tsx` 接近 900 行预算，当前 865 行，本轮净增 0。
- `tool-card-views.tsx` 接近 500 行预算，当前 466 行，本轮净增 0。
- `sidebar.tsx` 接近 500 行预算，当前 441 行，本轮净增 0。
- `chat-sidebar.test.tsx` 已在 900 行预算边界，本轮没有继续增加行数。
- `chat-message-list.container.tsx` 接近 500 行预算，当前 403 行，本轮净增 0。
- `service-apps-panel.tsx` 接近 500 行预算，当前 481 行，本轮净增 0。
- `provider-form.tsx` 历史上已超过 500 行预算，本轮净增 0。
- `doc-browser.tsx` 接近 500 行预算，当前 412 行，本轮净增 0。
- `shared/components/ui` 已有目录预算例外，本轮没有新增文件。

本轮是用户可见主题与视觉系统能力增强，非纯非功能改动，因此不适用“非测试生产语义代码净增 <= 0”的硬性收口目标。

`post-edit-maintainability-review` 结论：通过。正向动作是复用已有 theme token、删除固定色分支语义、把跨包 agent chat UI 的消息/工具/附件视觉收敛到同一主题合同；没有新增目录或抽象层。

## 发布/部署方式

已执行本地提交与正式 NPM 发布：

- 功能提交：`37a174846` (`Polish NextClaw UI theme system`)
- 版本提交：`3bfe2b58c` (`Version packages for stable release`)
- 包内 UI 发布资产提交：`bf257c79c` (`Refresh packaged UI assets`)
- 发布命令：`NPM_CONFIG_USERCONFIG=.npmrc pnpm release:publish`
- registry 验证：`pnpm release:verify:published` 已确认 `published 22/22 package versions`
- 正式安装验收：临时目录安装 `nextclaw@latest`，`nextclaw --version` 输出 `0.21.11`，独立 `NEXTCLAW_HOME` 下 `nextclaw update --check` 输出 runtime 已是最新。

未执行 `git push`、创建 PR、GitHub Release 或桌面端发布。

## NPM 包发布记录

已添加并消费 `.changeset/minimal-theme-visual-system.md`：

- `@nextclaw/ui`: patch
- `@nextclaw/agent-chat-ui`: patch

本轮正式 NPM 发布同时消费了两个既有待发布 changeset：

- `.changeset/chat-composer-streaming-stability.md`
- `.changeset/quiet-workspaces-smile.md`

已发布到 `latest` 的包：

- `nextclaw@0.21.11`
- `@nextclaw/ui@0.14.3`
- `@nextclaw/agent-chat-ui@0.5.3`
- `@nextclaw/core@0.14.7`
- `@nextclaw/kernel@0.5.3`
- `@nextclaw/service@0.2.17`
- `@nextclaw/server@0.14.7`
- `@nextclaw/runtime@0.3.17`
- `@nextclaw/remote@0.2.17`
- `@nextclaw/mcp@0.2.17`
- `@nextclaw/client-sdk@0.4.6`
- `@nextclaw/ncp-mcp@0.1.112`
- `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.16`
- `@nextclaw/nextclaw-narp-runtime-opencode@0.1.15`
- `@nextclaw/companion@0.1.34`
- `@nextclaw/channel-extension-dingtalk@0.1.21`
- `@nextclaw/channel-extension-discord@0.1.21`
- `@nextclaw/channel-extension-email@0.1.21`
- `@nextclaw/channel-extension-slack@0.1.21`
- `@nextclaw/channel-extension-telegram@0.1.21`
- `@nextclaw/channel-extension-wecom@0.1.21`
- `@nextclaw/channel-extension-whatsapp@0.1.21`

`npm view` 验证：

- `nextclaw`: `latest = 0.21.11`
- `@nextclaw/ui`: `latest = 0.14.3`
- `@nextclaw/agent-chat-ui`: `latest = 0.5.3`

## 后续建议

建议后续：

- 若 Probe 方向确认，再继续把 marketplace、频道设置、模型/搜索/语言设置等更深页面分批纳入同一 token 合同。
- 把 `chat-sidebar.test.tsx` 拆出 fixtures/builders，降低测试文件预算压力。
