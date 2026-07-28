# Mermaid 图表放大预览

## 迭代完成说明

- 为聊天消息中的 Mermaid 图表增加可发现、可键盘操作的放大入口；放大后使用与消息图片一致的模态预览体验。
- 根因是 Mermaid 渲染面只负责内联 SVG、流式更新和错误回退，没有接入消息图片已有的全屏查看能力。修复前的回归测试确认渲染完成后不存在可访问的放大按钮。
- 修复将图片私有灯箱提取为 chat UI 共享展示组件，图片与 Mermaid 复用同一套遮罩、关闭按钮、Escape 监听和页面滚动锁；没有复制第二套覆盖层逻辑。
- Mermaid 的内联 SVG 与稳定 `figure` 保持原位，全屏视图只渲染副本，因此流式更新、主题变化和错误回退链路不被改写。

## 测试/验证/验收方式

- 修前基线：新增交互测试失败，提示找不到名为 `Expand diagram` 的按钮。
- 定向功能测试：Mermaid、Markdown 图片、附件图片共 57 条测试通过，覆盖打开、内容点击不误关、关闭按钮、遮罩点击和 Escape 关闭。
- 类型检查：`@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 的 `tsc` 通过；UI 类型检查前先构建隔离工作树缺失的 `@nextclaw/server` 类型产物。
- 静态与构建：两个触达包 ESLint 通过；`@nextclaw/agent-chat-ui` 构建和 `@nextclaw/ui` Vite 消费端构建通过。
- 全包测试存在 3 条既有失败；已在未改动的本地 `master` 上以相同命令复现，分别是公共契约中的既有 `ReactNode`、Lexical/jsdom `Selection.modify` 缺失和文件预览旧断言，均不由本次变更引入。
- 治理：增量治理、历史债务棘轮、生成物清洁检查和可维护性守卫通过。

## 发布/部署方式

- 本次按委派合同只交付到本地 `master`，不 push、不创建 PR，不执行 release、deploy、migration 或生产操作。
- 用户可见变化已添加 changeset，等待后续统一发布。

## 用户/产品视角的验收步骤

1. 在聊天消息中打开一段已渲染完成的 Mermaid 图表。
2. 点击图表或聚焦图表后按 Enter/Space，确认出现覆盖窗口并可查看自然尺寸的完整图表。
3. 分别点击图表内容、关闭按钮和遮罩：内容点击不关闭，关闭按钮与遮罩可关闭。
4. 再次打开后按 Escape，确认预览关闭；随后继续接收流式 Mermaid 内容并切换明暗主题，确认内联图表保持稳定。

## 可维护性总结汇总

- 本次是新增用户能力，允许必要的生产代码增长；通过提取共享灯箱删除了图片中的私有实现，避免图片与 Mermaid 维护两套 portal、键盘和滚动锁逻辑。
- 共享组件放在 `chat/ui` owner，下层图片与 Mermaid 仅保留各自的打开状态和内容渲染；没有新增 manager、service、helper、兼容分支或 barrel。
- message-list 根目录文件数保持原有 17，没有继续扩大已记录豁免目录；守卫仅报告历史目录预算和接近文件预算的预警，无阻塞项。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`；无刻意保留的新债务。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch，当前未发布，待统一发布。
- `@nextclaw/ui`：需要 patch，当前未发布，待统一发布。
