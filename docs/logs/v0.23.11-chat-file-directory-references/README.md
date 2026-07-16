# v0.23.11 聊天文件与目录引用

## 迭代完成说明

- 聊天输入框的 `@` 入口升级为统一上下文引用菜单：根层同时提供“文件与文件夹”和已有面板应用，进入文件层后可以返回、浏览项目根目录或按名称搜索。
- 文件与目录结果展示相对路径和层级预览，选中后插入不可编辑 token；原始消息使用轻量协议表达引用，结构化 metadata 保留类型、相对路径和显示名。
- server 新增受项目根目录约束的懒加载搜索；空查询只列根层，非空查询执行有扫描上限的递归匹配，并跳过依赖、构建和缓存目录。
- kernel 新增 workspace reference context provider，在当前有效项目边界内解析引用：文件按文本/大小/总量上限读取，目录按深度/条目上限生成结构；绝对路径、越界、符号链接逃逸、二进制和类型不匹配均不会被静默展开。
- 修复真实输入时 `@` 菜单瞬间关闭的问题。根因是字符插入后紧接着到来的 selection 通知仍读取尚未提交的 React state，把刚创建的 trigger identity 清空；现在共享 input-surface host 用同步 ref 作为事件序列 owner，并继续用 state 驱动渲染。
- 输入事件不再要求物理按键标签必须等于最终 marker；以 editor snapshot 中的实际文档结果为准，兼容 `@` 这类需要 Shift 组合键的输入。
- 设计依据见 `docs/designs/2026-07-16-chat-file-directory-references.design.md`。

## 测试/验证/验收方式

- TypeScript：`@nextclaw/shared`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/ui` 六个触达 package 的 `tsc` 全部通过。
- 定向测试：agent-chat-ui `60`、UI `51`、server `21`、client SDK `13`、kernel `4`，共 `149` 条通过；server 另有 `2` 条平台专项按当前 macOS 环境跳过。覆盖 trigger 生命周期、二级导航、搜索查询、token 插入/显示、metadata/原始协议、真实路由合同和 kernel 安全物化。
- package lint：六个触达 package 均为 `0 error`；shared、agent-chat-ui、client-sdk 为零 warning，kernel `1`、server `8`、UI `1` 条 warning 均位于本轮未修改的历史文件。
- 完整源码构建由 `pnpm local:source-runtime -- start --port 18976 --instance codex-at-reference` 执行，35 个 workspace package 构建通过并由最新静态产物启动隔离实例。
- 使用最新源码在 `http://127.0.0.1:18976/chat` 的隔离实例完成真实页面冒烟：输入 `@` 后根菜单显示“文件与文件夹”和面板应用；进入二级浏览后菜单保持展开并列出默认 workspace 根目录；输入 `AGENTS` 返回目录与文件匹配；选择 `AGENTS.md` 后插入不可编辑文件 token 并关闭菜单。
- 同一隔离实例通过真实 HTTP 调用 `/api/server-paths/search`，以 `/Users/peiwang/Projects/nextbot` 为根搜索 `context-reference`，返回两条当前源码文件结果及规范相对路径。
- 验收未发送聊天消息；草稿 token 已清空、浏览器页已关闭、隔离实例已停止，未替换或重启用户正在运行的 NextClaw 实例。
- `post-edit-maintainability-guard` 定向检查 `45` 个本轮代码文件：`0 error`、`10 warning`；首次检查发现主输入条测试文件越过 900 行预算后，已将 workspace reference 场景拆到独立测试文件，复检通过。
- `pnpm lint:new-code:governance`、governance backlog ratchet、`git diff --check` 与 `pnpm check:generated-clean` 均通过。治理仅报告两个既有平铺目录 warning，其中 context provider 目录已有 role contract 豁免。

## 发布/部署方式

- 本轮代码、设计、changeset 与迭代记录随当前提交一并落库；未执行 push、部署或发布。
- 不涉及数据库 migration 或远端服务部署。
- 已添加用户可见 changeset，后续统一 NPM 发布时由现有 Changesets 流程消费。

## 用户/产品视角的验收步骤

1. 打开一个已绑定项目目录的聊天，或在新任务中选择项目目录。
2. 在输入框键入 `@`，确认根菜单出现“文件与文件夹”和可用的面板应用。
3. 选择“文件与文件夹”，确认菜单不关闭，并显示返回入口与项目根目录内容。
4. 继续输入文件或目录名称，确认结果显示名称、父级路径和右侧层级预览。
5. 选择文件或目录，确认输入框插入对应图标 token；发送后 Agent 只获得该项目边界内、受大小和条目上限约束的上下文。

## 可维护性总结汇总

- 本次是新增用户可见能力，不适用非功能改动的生产代码净增 `<= 0` 门槛。
- 复用现有 ChatInputSurface、Lexical token、server path resolver、项目上下文和 context provider 主链路；删除仅支持面板应用的平行 `@` 插件，没有新增第二套 composer 或附件上传路径。
- UI 只拥有菜单模式和查询状态，server 拥有受控搜索，kernel 拥有安全物化与上下文预算；token 协议和 metadata 类型集中在 shared owner。
- 真实界面暴露的 trigger 生命周期问题修在共享 `ChatInputSurfaceHost` owner，斜杠与 `@` 面板共同受益；同步 ref 只负责事件序列 identity，React state 继续是渲染事实，没有新增 effect 或平行 store。
- 代码增减报告：45 个本轮代码文件共 `+1979 / -407`，净增 `1572` 行。
- 非测试代码增减报告：`+1309 / -319`，净增 `990` 行；这是新增用户能力，增长用于 server 搜索、kernel 安全物化、统一菜单/token 合同和 UI 交互，不适用非功能改动净增 `<= 0` 门槛。
- `post-edit-maintainability-review` 结论：通过，`no maintainability findings`。本轮删除旧的 panel-app-only `@` 插件和测试，复用现有 input surface、server path resolver、项目上下文与 context provider 主链路；路径预览已从菜单拆出，扫描策略与纯排序工具分离。保留的 watchpoint 是 `server-api.types.ts` 已到 897 行、`session-conversation-input.tsx` 已到 489 行，下一次继续增长前应优先拆分 server-path API 类型和收敛 conversation input 装配职责。

## NPM 包发布记录

- 本轮未执行 NPM 发布。
- 待统一发布：`@nextclaw/agent-chat-ui`、`@nextclaw/client-sdk`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/shared`、`@nextclaw/ui`、`nextclaw`，均由 `.changeset/chat-file-directory-references.md` 记录 patch 变更。
