# v0.16.39-chat-session-workspace-sidebar

## 迭代完成说明

本次把聊天页右侧从“仅子会话面板”升级成“会话级 workspace sidebar”，目标不再只是看 child session，而是让当前会话里已经打开的工作对象都能在同一处连续操作。

相关方案文档：

- [Chat Session Workspace Sidebar Implementation Plan](../../plans/2026-04-16-chat-session-workspace-sidebar-plan.md)

本轮实际落地内容：

1. 右侧面板从 child-session-only UI 重构为 session workspace sidebar：仍然是右侧工作区，但内部结构改成顶部 tab 条 + 下方内容区，而不是左侧分组导航。
2. 为聊天共享 UI 增加显式 `onFileOpen` action，不再靠隐式 DOM 行为；消息 markdown、本地文件链接、工具卡文件路径都能统一把打开请求送到会话 workspace。
3. 工具卡文件路径升级为可点击入口；点击后会把结构化 diff 数据直接打开到右栏，而不是只停留在卡片内的小片段。
4. 新增会话级 opened-files 状态模型，`NcpChatThreadManager` 统一负责打开、激活、关闭文件项，以及与 child session 之间的焦点切换；同一文件的 `preview` 与 `diff` 现在作为两个独立打开类型共存，而不是一个文件内切换。
5. 新增服务端文本文件预览接口 `GET /api/server-paths/read`，支持基于当前 session `projectRoot` 解析相对路径，并对 binary 文件返回显式不可预览元信息。
6. 文件预览右栏优先复用现有 markdown 渲染、结构化 diff 行模型与文件卡片解析能力；当前进一步收敛为共享 `FileOperationCodeSurface` 渲染器，由同一个组件提供 `compact`（工具卡）和 `workspace`（右栏全高编辑器）两种布局，避免样式和行号宽度继续漂移。`preview` 只对应文件链接打开，`diff` 只对应工具改文件入口打开。
7. 删除已经失去生产引用的旧 `ChatChildSessionPanel`，避免“旧子会话面板 + 新 workspace 面板”双轨并存。
8. 同步补齐 agent-chat-ui、nextclaw-ui、nextclaw-server 三侧测试，覆盖：
   - markdown 本地文件链接拦截；
   - 工具卡路径点击触发文件打开 action；
   - workspace sidebar 的顶部 tab 显示与同文件 preview/diff 分离；
   - server path read 的文本 / binary / relative-base-required 行为。
9. 追加修正 workspace 文件预览 / diff 的短内容视图高度与样式对齐：把共享代码区收敛成 `FileOperationCodeSurface`，由同一套行号宽度、row height、padding、tone 和键值策略同时服务工具卡与 workspace；其中 `compact` 布局继续用于工具卡，`workspace` 布局负责右栏全高两列编辑器（独立 gutter 列 + 代码画布列 + 底部 filler），从源头保证两边视觉语义一致。

## 测试 / 验证 / 验收方式

已完成：

1. `pnpm -C packages/nextclaw-agent-chat-ui tsc`
2. `pnpm -C packages/nextclaw-ui tsc`
3. `pnpm -C packages/nextclaw-server tsc`
4. `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
5. `pnpm -C packages/nextclaw-ui test -- src/components/chat/chat-conversation-panel.test.tsx src/components/chat/containers/chat-message-list.container.test.tsx src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/ncp/tests/ncp-chat-thread.manager.test.ts`
6. `pnpm -C packages/nextclaw-server test -- src/ui/ui-routes/server-path.controller.test.ts`
7. `pnpm -C packages/nextclaw-agent-chat-ui build`
8. `pnpm -C packages/nextclaw-server build`
9. `pnpm -C packages/nextclaw-ui build`
10. `pnpm -C packages/nextclaw build`
11. 真实运行态冒烟：
    - `NEXTCLAW_HOME="$(mktemp -d /tmp/nextclaw-workspace-sidebar-dist-smoke.XXXXXX)" node packages/nextclaw/dist/cli/index.js serve --ui-port 18794`
    - `curl -I http://127.0.0.1:18794/chat`
    - `curl -s http://127.0.0.1:18794/chat | head -n 5`
    - `curl -s http://127.0.0.1:18794/api/health`
12. 维护性治理：
    - `pnpm lint:maintainability:guard`
    - `pnpm lint:new-code:governance`
13. 追加 UI 高度修正回归：
    - `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
    - `pnpm -C packages/nextclaw-agent-chat-ui tsc`
    - `pnpm -C packages/nextclaw-agent-chat-ui build`
    - `pnpm -C packages/nextclaw-ui tsc`
    - `pnpm -C packages/nextclaw-ui test -- src/components/chat/chat-session-workspace-file-preview.test.tsx`
    - `pnpm -C packages/nextclaw-ui build`

结果：

1. 受影响包类型检查通过。
2. 受影响测试通过：`agent-chat-ui` 3 个 test files / 12 个 tests，`nextclaw-ui` 5 个 test files / 30 个 tests，`nextclaw-server` 1 个 test file / 5 个 tests。
3. 三个受影响子包和聚合包 `packages/nextclaw` build 均通过。
4. `@nextclaw/ui` build 仍保留既有 `chat-page` chunk 大于 500 kB warning，不阻断本次构建。
5. 真实打包产物启动成功，CLI 输出 `UI API: http://0.0.0.0:18794/api`、`UI frontend: http://0.0.0.0:18794`、`UI NCP agent: ready`。
6. `curl -I http://127.0.0.1:18794/chat` 返回 `HTTP/1.1 200 OK`，`curl -s http://127.0.0.1:18794/chat | head -n 5` 返回 HTML 文档头，`curl -s http://127.0.0.1:18794/api/health` 返回 `{"ok":true,"data":{"status":"ok","services":{"ncpAgent":"ready","cronService":"ready"}}}`。
7. 浏览器级 DevTools 冒烟尝试过，但本机 Chrome DevTools MCP profile 被占用，未能在本次会话里拿到独占浏览器实例；因此本轮以真实服务 HTTP 冒烟 + 受影响 UI 测试覆盖补位。
8. `pnpm lint:maintainability:guard` 失败，但 error 项集中在仓库中其它并行改动的 `packages/extensions/nextclaw-ncp-runtime-*` 和既有大测试文件，不在本次 workspace sidebar 核心实现内。
9. `pnpm lint:new-code:governance` 仍被仓库里其它已 touched 文件阻断；其中也包含本次不得不触达的历史入口文件 `packages/nextclaw-server/src/ui/router.ts`、`packages/nextclaw-ui/src/api/server-path.ts`、`packages/nextclaw-ui/src/lib/i18n.chat.ts` 的命名债务，但本次没有额外引入新的违规命名模式。

## 发布 / 部署方式

本次同时涉及前端与 UI server，但不涉及数据库迁移、配置迁移或额外后台任务。

发布时按正常 NextClaw 包流程处理：

1. 发布 `@nextclaw/agent-chat-ui`，包含新的 `onFileOpen` 能力与文件路径点击交互。
2. 发布 `@nextclaw/server`，包含新的 `/api/server-paths/read` 接口。
3. 发布 `@nextclaw/ui`，包含新的 session workspace sidebar、顶部 tab 工作区、文件 preview / diff 视图与 child session 集成。
4. 若随 CLI / 桌面包一起出包，按既有流程重建并同步 `packages/nextclaw/ui-dist`。

## 用户 / 产品视角的验收步骤

1. 打开 NextClaw 聊天页，进入一个存在 child session 的父会话。
2. 点击会话头部或左侧列表里的 child session 入口，确认右侧打开的是 workspace sidebar，而不是旧的单一子会话面板。
3. 确认右侧顶部出现统一 tab 条；child session 和打开的文件共用这一条 tab rail，而不是左右分栏的导航列表。
4. 切换不同子会话 tab 时，右侧内容区会跟随切换，未读点只留在未读且未激活的子会话 tab 上。
5. 在会话消息里点击一个真实存在的本地文本文件链接，例如 `/absolute/path/to/file.md:12`，确认右侧新增一个文件 tab，并显示 markdown 预览或文本预览。
6. 触发一次会改文件的工具调用，等工具卡出现文件路径后点击该路径，确认右侧新增的是 diff tab，内容直接显示 diff，而不是在同一个文件里再切换 preview/diff。
7. 如果同一文件既从 markdown 链接打开过 preview，又从工具卡打开过 diff，确认两者会作为两个独立 tab 共存。
8. 确认文件 tab 默认只展示文件名，超长路径通过 hover tooltip 查看完整值。
9. 打开一个 binary 文件或在无 `projectRoot` 的会话里点击相对路径，确认右侧给出显式不可预览 / 无法解析提示，而不是静默展示错误内容。
10. 关闭文件项或关闭整个右侧 workspace sidebar，确认主聊天区不受影响。

## 可维护性总结汇总

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

长期目标对齐 / 可维护性推进：

1. 这次改动顺着 NextClaw “统一入口 / 连续工作台”的长期目标前进了一步：右侧不再只是 child session 特化面板，而是开始承担会话级工作区的角色。
2. 文件 preview / diff 没有另起炉灶做一个平行浏览器，而是复用已有 markdown、diff line model、tool-card file operation adapter，把体验统一在同一条能力链上。
3. 本次顺手删除了已无生产引用的 `ChatChildSessionPanel`，避免旧 UI 壳继续悬挂为历史债务。
4. 这次高度修正最终收敛到共享 `FileOperationCodeSurface`：工具卡和 workspace 不再各自维护一套 row/gutter 语义，而是复用同一套 line number 宽度、tone、padding 与 key 逻辑，只在布局层切成 `compact` 和 `workspace` 两种模式。

本次是否已尽最大努力优化可维护性：是，但保留了有限且明确的债务。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。

1. 没有新增第二套 store、query 镜像或 diff renderer；文件 preview / diff 直接复用既有数据模型与渲染原语。
2. 删除了旧 `ChatChildSessionPanel` 与其单一职责 UI 壳，避免新 sidebar 落地后继续维持双轨实现。
3. 新增长度主要来自真实新能力：会话级文件状态、右栏内容区、服务端文本读取接口与回归测试；这部分增长已经是在“统一一套右栏”的前提下的最小必要新增。
4. 本次补丁延续这一原则，没有继续让 workspace 拷贝一份 row/gutter 逻辑，而是把两边都收回共享 renderer；新增的是一个可复用的 code surface 组件和对应布局分支，代价小于继续维持两套逐步漂移的实现。

代码增减报告：

1. 新增：1879 行
2. 删除：560 行
3. 净增：+1319 行

非测试代码增减报告：

1. 新增：1539 行
2. 删除：347 行
3. 净增：+1192 行

说明：

1. 这次净增较大，因为交付的是一条新的连续能力链，而不是局部修补：它跨越共享聊天 UI、前端 workspace 状态 owner、UI server 文件读取接口、测试和用户可见交互。
2. 在接受净增之前，本次已经先做了几件减法：复用文件卡片结构化数据、删除旧 child session panel、避免新增第二套浏览器/右栏状态、把 preview / diff 保持为同一套 file tab 基础模型上的两种独立打开类型。
3. 若继续压缩，最容易破坏的是“一个侧栏统一承载 child session 与 open files”的核心目标，因此当前实现已达到较实用的最小必要点。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。

1. `NcpChatThreadManager` 继续作为会话线程 owner，统一负责 workspace 打开/关闭/聚焦，不把状态迁移散回组件。
2. server 侧把文本文件预览封进单独的 `server-path-read.utils.ts`，没有继续堆进既有 browse 逻辑。
3. 右栏 UI 被拆成 `workspace panel`、`workspace panel nav`、`file preview` 三个部件，主面板不再独自承担全部 sidebar 细节。
4. 这次高度修正进一步把 owner 边界收清：共享 `FileOperationCodeSurface` 统一持有行号宽度、tone 与行渲染规则，workspace 只声明自己要 `workspace` 布局，工具卡只声明自己要 `compact` 布局，不再在调用方复制样式判断。

目录结构与文件组织是否满足当前项目治理要求：基本满足，但保留一项已知债务。

1. 新增文件均使用 kebab-case 命名，并保持在现有 chat / server-path 责任域内。
2. 本次通过删除 `chat-child-session-panel.tsx` 抵消了一部分目录平铺增长，但 `packages/nextclaw-ui/src/components/chat/` 仍然处于异常扁平目录，需要后续进一步收敛。
3. 下一步最值得继续删减/整理的入口是：把 `workspace file preview` 的状态推导与 `ncp-chat-thread.manager.ts` 的 file-tab 生命周期再向稳定子模块下切，继续压缩 chat 根目录平铺度与 manager 膨胀。

可维护性复核：

1. `NcpChatThreadManager` 在本次引入 file preview / open-files 生命周期后增长明显，继续把 workspace 文件打开、切换、关闭逻辑都堆在这里，会让“会话路由 owner”和“文件工作区 owner”逐步缠在一起。
2. 这会提高后续继续加 pinned file、preview history、diff compare 等能力时的修改半径，使一次 sidebar 需求同时触发路由、会话、文件状态的混合改动。
3. 更小、更稳的下一步是把 file-tab 生命周期下切成明确的 workspace owner（例如 `chat-workspace-file.manager.ts` 或等价边界），仍由 thread manager 编排，但不让它继续直接承载全部细节。

4. `packages/nextclaw-ui/src/components/chat/` 本次虽然删掉了旧 `chat-child-session-panel.tsx`，但净效果仍是目录继续维持高平铺度。
5. 这会让聊天入口层越来越像“所有东西都放在根目录”的增长模式，后续查找 sidebar / workspace 相关代码的认知成本继续偏高。
6. 更小、更稳的下一步是把 `chat-session-workspace-panel.tsx`、`chat-session-workspace-panel-nav.tsx`、`chat-session-workspace-file-preview.tsx` 下沉到稳定子目录，例如 `components/chat/workspace/`，把根目录重新收窄成页面壳和装配层。

可维护性总结：

这次改动没有做到总代码净减少，但它把右侧能力从“子会话特例”收敛成了“会话工作区”，同时删除了已经废弃的旧子会话面板，方向上是统一而不是继续分裂。保留的主要债务是 `NcpChatThreadManager` 的职责继续变厚、chat 根目录仍然偏扁平；后续最值得继续推进的是把 workspace file 生命周期和 workspace UI 文件下沉到稳定子模块。
