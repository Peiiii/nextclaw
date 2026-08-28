# 岛屿主题

## 迭代完成说明

- 新增可在外观设置中选择并持久化的“岛屿”主题，以连续水彩纸景、原创热带树影、沿海绿色墨色和打字残影构成完整视觉语言。
- 统一应用壳、Header、导航、会话内容、搜索、输入框、用户消息、工作台、全局 Doc Browser、SideDock、文件与代码预览的透明层级，让同一张背景贯穿真实数据页面。
- 统一 Popover、菜单、Select、Tooltip、Dialog、Sheet 等浮层材质和交互状态；思考、读取、执行等过程图标及展开内容不再出现割裂的实心白底。
- 将用户选定的真实岛屿主题工作台截图登记为正式产品资产，并按内容放到官网“主动送达”、文档站 AI 收件箱介绍和中英文 GitHub README 对应产品导览中；核心 Hero 继续使用能直接证明对话与任务交付的原截图。
- 官网把“主动送达”提前到交互产物和 Runtime 之前，并扩大首屏响应式横向留白；在中等桌面宽度同步调整两栏占比，保证标题和产品截图保持协调。
- 同步中英文配置文档、主题选择文案、主题资源和用户可见 changeset。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- UI 定向测试：文件预览、Doc Browser、应用面板和右键菜单共 64 项通过。
- Agent Chat UI 定向测试：代码预览与会话过程折叠共 11 项通过。
- `pnpm --filter @nextclaw/ui build`：通过。
- `node .agents/skills/development-review/scripts/check-maintainability.mjs`：0 error；仅报告已有目录预算例外和接近文件预算的警告。
- `git diff --check`：通过；本地预览 `/appearance` 返回 HTTP 200。
- 官网 build/tsc/lint 与文档站 build 通过；截图源资产、文档软链接和官网镜像哈希一致，`pnpm release:summary -- --json` 正确识别中英文 release-note-image 且无错误。
- 用户在真实页面持续检查背景连续性、右侧面板、代码预览、过程信息和浮层，并在最终调整后明确确认“好了”。

## 发布/部署方式

本次提交并推送实现、资源、文档、changeset 和迭代记录；官网通过 Cloudflare Pages 的 `nextclaw-landing` 项目部署，文档站通过 `docs-deploy.yml` 从远程 `master` 发布。不执行 NPM 或桌面版本发布。

## 用户/产品视角的验收步骤

1. 打开“设置 → 外观”，选择“岛屿”主题并刷新，确认选择保持。
2. 打开真实会话和右侧工作台，确认背景从会话区连续贯穿工作台、全局 Doc Browser 与 SideDock。
3. 浏览文件树并预览 JSON/代码文件，确认代码画布和普通代码行透出背景，行号、当前行和 diff 状态仍可辨识。
4. 展开思考过程、工具执行记录，确认图标和展开正文没有实心白色贴片。
5. 打开菜单、Popover、Select、Tooltip、Dialog 与 Sheet，确认浮层使用分级半透明纸面且键盘焦点、选中、危险和禁用状态清晰。

## 可维护性总结汇总

- 主题差异集中在 `island-theme.css`，组件只增加稳定的语义化 `data-theme-*` 标记，避免把岛屿主题判断分散进业务组件。
- 背景、工作区、文件预览、过程信息和浮层分别使用已有 surface/overlay owner，不新增 wrapper、manager 或重复状态链路。
- 新增资源集中在 `public/themes/island/`，设计说明使用符合治理规则的日期与角色后缀。
- 自动维护性检查为 0 error；警告均为既有目录预算例外或接近预算提示，本次未新增目录文件数量，也未扩大相关组件职责。

## NPM 包发布记录

- 本次用户可见变化需要后续统一发布 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` 的 patch 版本，已由 `.changeset/quiet-islands-glow.md` 记录。
- 当前仅提交，未执行 NPM 发布；状态：待统一发布。
