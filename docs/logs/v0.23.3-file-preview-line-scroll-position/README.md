# v0.23.3-file-preview-line-scroll-position

## 迭代完成说明

本批修复源码深链接只指定行号时，右侧文件预览会横向偏移一个行号栏宽度的问题。

根因是共享代码表面统一把目标代码单元格交给 `scrollIntoView`：即使链接只有 `#L12`，浏览器也会为了让位于行号栏右侧的超宽代码单元格进入视口而产生横向滚动。真实页面测得修前源码容器 `scrollLeft = 43`。

修复没有新增第二套滚动逻辑，而是让既有定位锚点与 URI 语义一致：只指定行号时锚定左侧目标行号，因此纵向定位后横向保持起点；指定列号时仍锚定列光标并横向居中。修后使用同一链接测得 `scrollLeft = 0`，第 12 行仍在可视区域。

## 测试/验证/验收方式

- 修前先新增行定位锚点回归测试，确认旧实现把代码单元格而不是行号单元格交给 `scrollIntoView`；修复后定向测试 5 项全部通过。
- `corepack pnpm -C packages/nextclaw-agent-chat-ui tsc` 通过。
- `corepack pnpm -C packages/nextclaw-agent-chat-ui lint` 通过。
- 包级测试共 217 项，215 项通过；2 项既有失败分别来自 `ReactNode` 公共合同断言和长行 class 断言，均不在本次触达文件和行为链路内。
- `corepack pnpm lint:new-code:governance -- <2 个触达文件>` 与 `corepack pnpm check:governance-backlog-ratchet` 通过。
- 可维护性 guard 以 `--non-feature` 检查 2 个触达文件：0 error、0 warning；总计新增 41 行、删除 7 行、净增 34 行，排除测试后新增 7 行、删除 7 行、净增 0 行。
- 在 `http://127.0.0.1:5174/chat/sid_bmNwLW1ya284Z3NkLWY2NWUyNGM4` 打开 `file:///tmp/dev-demo.html#L12`：修前 `scrollLeft = 43`，修后 `scrollLeft = 0`；目标第 12 行 `</style>` 仍在可视区域。

## 发布/部署方式

本次未执行发布或部署。新增 `.changeset/file-preview-line-scroll-position.md`，后续随 `@nextclaw/agent-chat-ui` 统一发布 patch。

不涉及后端、数据库、migration 或远程部署；当前本地 5174 源码实例已完成真实页面验收。

## 用户/产品视角的验收步骤

1. 在会话中点击 `[源码](file:///tmp/dev-demo.html#L12)`。
2. 确认右侧源码预览定位到第 12 行，同时横向滚动条保持最左侧起点。
3. 再打开包含列号的 `#L12C4` 链接，确认第 4 列仍会被带入视口。

## 可维护性总结汇总

- 本批没有新增参数、helper、组件、状态或滚动路径，只调整共享代码表面的既有定位锚点。
- 非测试代码新增 7 行、删除 7 行、净增 0 行，满足非功能改动门槛。
- 正向减债动作为简化：行号读取去掉了不必要的中间值和类型分支；定位职责仍由唯一的 `useLayoutEffect` 同步外部 DOM，没有扩散到 workspace 宿主。
- React 组件类型、key 和父级结构均未改变；文件预览这个硬生命周期边界不会因本次修复重挂载。
- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 复核；no maintainability findings。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch，changeset 已添加，当前待统一发布。
