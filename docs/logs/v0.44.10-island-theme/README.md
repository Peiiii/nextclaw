# 岛屿主题

## 迭代完成说明

- 新增可在外观设置中选择并持久化的“岛屿”主题，以连续水彩纸景、原创热带树影、沿海绿色墨色和打字残影构成完整视觉语言。
- 统一应用壳、Header、导航、会话内容、搜索、输入框、用户消息、工作台、全局 Doc Browser、SideDock、文件与代码预览的透明层级，让同一张背景贯穿真实数据页面。
- 统一 Popover、菜单、Select、Tooltip、Dialog、Sheet 等浮层材质和交互状态；思考、读取、执行等过程图标及展开内容不再出现割裂的实心白底。
- 将用户选定的真实岛屿主题工作台截图登记为正式产品资产，并按内容放到官网“主动送达”、文档站 AI 收件箱介绍和中英文 GitHub README 对应产品导览中；核心 Hero 继续使用能直接证明对话与任务交付的原截图。
- 官网把“主动送达”提前到交互产物和 Runtime 之前，并扩大首屏响应式横向留白；在中等桌面宽度同步调整两栏占比，保证标题和产品截图保持协调。
- 修复岛屿主题背景刷新后仍反复慢加载的问题：根因是主题图片位于稳定 `/themes/` 路径，UI server 仅允许 `/assets/` 下的哈希文件使用长期缓存，因此该图片一直返回 `no-store`，同时 HTML 启动阶段没有根据持久化主题提前请求图片。通过实际响应合同与构建产物确认根因后，将图片重新编码为同分辨率 84,810 字节 WebP、改用内容哈希路径，扩展静态资源缓存 owner，并在 Island 启动时条件预载；修复直接恢复缓存和发现时序，而不是增加遮罩或延迟动画掩盖症状。
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
- 背景性能修复：`@nextclaw/ui` 与 `@nextclaw/server` TypeScript 检查通过；UI 生产构建通过；Server 缓存边界测试 7 项通过；定向 ESLint 无错误。浏览器验证 Island 启动会在主模块前生成高优先级预载，普通主题不生成；构建产物只包含 84,810 字节的哈希图片，Server 对该类路径返回 `public, max-age=31536000, immutable`，页面和无哈希资源仍为 `no-store`。
- 用户在真实页面持续检查背景连续性、右侧面板、代码预览、过程信息和浮层，并在最终调整后明确确认“好了”。

## 发布/部署方式

主题首批交付已提交并推送实现、资源、文档、changeset 和迭代记录；官网通过 Cloudflare Pages 的 `nextclaw-landing` 项目部署，文档站通过 `docs-deploy.yml` 从远程 `master` 发布。背景性能修复通过稳定 NPM 发布流程交付 `@nextclaw/ui` 与 `@nextclaw/server`，并同步常规 runtime/product channel；桌面安装包不在本次范围内。

## 用户/产品视角的验收步骤

1. 打开“设置 → 外观”，选择“岛屿”主题并刷新，确认选择保持。
2. 打开真实会话和右侧工作台，确认背景从会话区连续贯穿工作台、全局 Doc Browser 与 SideDock。
3. 浏览文件树并预览 JSON/代码文件，确认代码画布和普通代码行透出背景，行号、当前行和 diff 状态仍可辨识。
4. 展开思考过程、工具执行记录，确认图标和展开正文没有实心白色贴片。
5. 打开菜单、Popover、Select、Tooltip、Dialog 与 Sheet，确认浮层使用分级半透明纸面且键盘焦点、选中、危险和禁用状态清晰。
6. 刷新 Island 页面，确认背景立即参与首屏绘制且不反复重新下载；切换到其它主题后刷新，确认不会请求 Island 背景。

## 可维护性总结汇总

- 主题差异集中在 `island-theme.css`，组件只增加稳定的语义化 `data-theme-*` 标记，避免把岛屿主题判断分散进业务组件。
- 背景、工作区、文件预览、过程信息和浮层分别使用已有 surface/overlay owner，不新增 wrapper、manager 或重复状态链路。
- 新增资源集中在 `public/themes/island/`，设计说明使用符合治理规则的日期与角色后缀。
- 自动维护性检查为 0 error；警告均为既有目录预算例外或接近预算提示，本次未新增目录文件数量，也未扩大相关组件职责。
- 背景性能修复把缓存决策收敛到既有 UI server owner，启动阶段只增加条件预载，不新增 React 状态、loader、wrapper 或第二套资源链路；测试夹具与缓存断言抽成小型 helper 后，自动维护性检查保持 0 error，未新增文件或目录预算恶化。

## NPM 包发布记录

- 背景性能修复已随 NextClaw `0.45.4` 发布：`@nextclaw/ui@0.22.3`、`@nextclaw/server@0.20.3` 与 `nextclaw@0.45.4` 均已从 NPM registry 回读验证；正式 Release 为 `nextclaw@0.45.4`。
- 四个平台的稳定 Runtime 更新通道已发布，并在各平台构建中通过签名、真实 HTTP 启用与组件生命周期验证。
- 发布观测：产品发布执行共 26 分 48 秒；最慢阶段为 Runtime 通道发布与验签（16 分 52 秒），其次是最终升级验收（5 分 14 秒）。NPM 批次、Runtime 通道和 GitHub Release 均成功；最终工作流仅在验收结束后的临时目录删除遇到 `ENOTEMPTY` 而标红，未影响已发布包或 Runtime 资产。
- 防复发：发布校验已改为使用 Node 的带重试递归删除（20 次、250ms 间隔）清理临时目录，覆盖服务子进程刚退出时仍写入目录的竞争窗口；该内部保障随 `fix(release): retry published smoke cleanup` 提交到 `master`，不额外制造用户版本。
