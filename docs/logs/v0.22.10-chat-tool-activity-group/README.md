# v0.22.10-chat-tool-activity-group

## 迭代完成说明

本次把 chat 工具过程展示拆成两层，并修正中文汇总文案与折叠 meta 行对齐。

根因与确认：

- 用户反馈 Claude Code 的工具展示好在信息层级：连续工具应收成分类数量摘要，而不是平铺重卡片。
- 第一版错误地把工具语义塞进外层 `processSummary`（`已处理`），与“整段过程总收起”混层。
- 用户明确要求：`已处理` 只做总收起；连续 tool-card 单独汇总；中间出现文本/reasoning 必须打断合并。
- 汇总文案不能写 `命令 2 条命令` 这类叠词，也不能塞命令路径或 `+1` 代表对象。
- 思考块与工具汇总左侧图标未共用同一 meta 行规范，导致不对齐。
- 文件型工具汇总沿用了通用调用计数器，因此同一路径被编辑多次时会被误报为多个文件；通过结构化 `fileOperation.blocks[].path` 确认每次调用已有可靠的文件身份。
- 内置工具展示只识别了命令、文件和搜索三个局部集合，没有覆盖 `DEFAULT_TOOL_CATALOG` 中的目录、网页、消息、会话、记忆、定时任务等工具，导致已知工具继续显示原始英文名和通用图标。

修复方式：

1. 外层 `processSummary` 恢复纯 `已处理` / `Processed`（可选 lifecycle 耗时），不承载工具语义。
2. 内层新增连续 tool-card 分组：
   - 连续 `tool-card` 合并；中间只隔 reasoning 时继续归入同一组
   - markdown / 文件 / 未知消息打断
   - 单条 tool 不建组
   - 文案用自然语言模板：`运行 2 条命令` / `Read 2 files`
3. 抽出共享 `ChatCollapsibleMetaSummary`，让 `已处理`、工具汇总、思考共用同一 chevron 尺寸、间距与对齐。
4. 设计文档同步为两层分离合同：`docs/designs/2026-07-12-chat-tool-activity-semantic-summary.design.md`。

同批次体验补充：

- 思考、工具、普通文本统一为正文行高与零额外块间距；`已处理` 分割线单独保留上下留白。
- 思考折叠行按运行态/完成态展示字符数，使用 Unicode 字符计数区分不同思考段。
- 已识别的命令、读文件、编辑和搜索工具使用 i18n 状态文案，例如 `编辑中`、`已编辑`、`编辑失败`。
- 工具工作流连线固定在图标列，内容统一右移；折叠态首尾连线延长，展开内容不再与连线重叠。
- reasoning 不再阻断工具汇总；汇总只计算工具，展开后仍按原顺序保留 reasoning 与工具明细。
- 读文件和编辑文件按结构化文件路径去重统计；同一文件被多次调用时，概览显示实际不同文件数，展开明细仍保留全部调用。
- `list_dir` 使用目录图标与“正在查看目录 / 已查看目录 / 查看目录失败”等状态文案，并按不同路径汇总为“查看 N 个目录”。
- 内置网页、消息、会话、子任务、记忆、定时任务、服务管理、图片和结果展示工具统一使用语义图标与 i18n 状态；未知扩展工具才保留通用扳手卡。
- 编辑工具概览直接从结构化 diff 行汇总 `+N -N`，默认使用弱化文本色，整行 hover 后分别切换为绿色和红色。
- 终端输出保留 ANSI 语义并提供更清晰的命令、输出、工作目录和退出码展示；文件 diff/预览保持单一 gutter 与可滚动代码区。
- 聊天中的 skill 引用支持点击后在文件预览中打开对应 skill 内容。

## 测试/验证/验收方式

- 新增/更新测试：
  - `packages/nextclaw-agent-chat-ui/.../chat-tool-activity-group.utils.test.ts`
  - `packages/nextclaw-agent-chat-ui/.../chat-message-list.generic-tool.test.tsx`
  - `packages/nextclaw-ui/.../chat-message-process-summary.utils.test.ts`
  - container / message-list 相关期望同步
- 文件计数回归验收：重复编辑 `src/app.ts` 两次，再由一次补丁同时触达 `src/app.ts` 与 `src/theme.ts`，概览显示 `Edit 2 files`；相关 2 个测试文件 10 项通过。
- 内置工具展示回归：默认内置工具目录及 NextClaw 会话/展示工具均验证了本地化完成态与对应图标；共享聊天 UI 定向 3 个测试文件 35 项通过。
- 本轮补充回归最终合并为共享聊天 UI 4 个测试文件 37 项、宿主 i18n 1 个测试文件 1 项，全部通过；`@nextclaw/agent-chat-ui` 的 `tsc` 与完整 lint 通过。
- 当前并行附件预览 WIP 使 `@nextclaw/ui` 的 `tsc` 阻塞在未纳入本提交的 `chat-message-list.container.test.tsx` 类型错误，并使 `lint:new-code:governance` 阻塞在未纳入本提交的附件测试跨层导入；`@nextclaw/ui` 完整 lint 无 error、保留 2 个既有 warning，backlog ratchet 通过。
- 定向测试：`@nextclaw/agent-chat-ui` 9 个文件 46 项通过；`@nextclaw/ui` 聊天宿主容器 14 项通过。
- 类型检查：`pnpm --filter @nextclaw/agent-chat-ui tsc`、`pnpm --filter @nextclaw/ui tsc` 通过。
- 两个相关 package 的完整 ESLint 均无 error；`@nextclaw/ui` 保留两个 warning：HEAD 既有的 803 行测试文件，以及本批定时任务组件的既有复杂度热点。
- `@nextclaw/ui` 完整 156 个测试文件、658 项测试通过。
- `@nextclaw/agent-chat-ui` 完整测试中 145/147 项通过；剩余两项是 HEAD 已存在的合同/旧布局断言失配，本次未触达对应实现或测试文件，定向变更集全部通过。
- 本地源码实例 `http://127.0.0.1:18888` 浏览器验收：思考、Markdown、工具行的计算行高均为 `25.456px`，相邻行无额外 margin/padding；`已处理` 分割区包含 `8px` 下内边距、`8px` 下外边距和 `1px` 分割线。

## 发布/部署方式

本次未执行发布、部署、推送。

发布判断：

- 用户可见 UI 交互增强，已新增 `.changeset/chat-tool-activity-group.md`。
- 影响包：`@nextclaw/agent-chat-ui` patch、`@nextclaw/ui` patch。
- 后续统一 NPM 发布时由 changesets 聚合。

## 用户/产品视角的验收步骤

1. 打开一个包含多次连续工具调用、中间夹文本、最后有最终回答的会话。
2. 完成态默认应看到外层 `已处理`（可带耗时），不是工具分类文案。
3. 展开过程后，连续工具应收成例如：`读取 2 个文件 · 运行 1 条命令`。
4. 中间只有思考时，前后工具仍属于同一汇总；中间出现 assistant 正文时才分组。
5. 只有一个工具时，不出现汇总行，直接显示原 tool card。
6. 思考与工具汇总左侧折叠图标尺寸、间距、基线一致。
7. 编辑工具概览展示 `+N -N`；默认颜色克制，hover 整行时新增变绿、删除变红。
8. 展开汇总后，工具与思考按原始顺序保留，连线位于图标列且不覆盖内容。
9. 同一个文件连续编辑多次时，汇总里的文件数量只计一次；展开后仍能看到每次编辑调用。
10. `list_dir` 不再显示原始英文工具名；完成态显示“已查看目录”，连续调用按不同目录路径汇总。

## 可维护性总结汇总

可维护性复核结论：通过（披露项见下）。

- 正向动作：把 outer process summary 与 inner tool activity 分层，避免一个 label 承载两种语义。
- 正向动作：工具汇总文案改为完整 i18n 模板，避免动作名+量词硬拼。
- 正向动作：折叠 meta 行抽共享组件，减少三套 summary 样式漂移。
- 正向动作：把行高、图标列和内容缩进收敛到共享 process row 合同，避免 reasoning/tool 各自维护漂移样式。
- 正向动作：状态文案由宿主 i18n owner 提供，组件不再内联按语言分支。
- 正向动作：编辑增删统计直接消费结构化 diff 事实，避免解析展示 caption。
- 正向动作：文件型活动由调用次数改为结构化路径集合，概览语义回到真实资源数量；其它工具继续按调用次数统计，未引入平行汇总路径。
- 正向动作：把内置工具名称到语义状态/图标的映射集中到现有 `ChatToolCard` 路由，通用卡只承担未知扩展工具，避免继续散落工具名特判。
- 正向动作：把通用可展开工具卡从接近 500 行预算的 `tool-card-views.tsx` 拆到同目录独立组件，并删除未使用的样式字段；`tool-card/` 直属文件为 11 个，仍在目录预算内。
- 流程改进：`code-investigation-workflow` 增加 catalog/registry 投影覆盖审计要求；以后用户点名某个目录项缺失时，必须先对照 canonical 事实源检查完整覆盖，而不是继续单项补漏。
- 正向动作：终端相关的 pane、ANSI utils 与测试折叠到 `tool-card/terminal/` 稳定子目录，`tool-card/` 根目录重新回到预算内；未增加 barrel。
- 治理结果：maintainability guard 无 error；原聊天展示批次的 `lint:new-code:governance` 已通过，本轮复跑受未纳入提交的并行附件测试导入阻塞；backlog ratchet 继续通过。
- 保留观察点：message-list 根目录仍有已登记的文件数预算 warning（17 个文件，增量为 0），本次未新增直属文件或结构债务。
- 保留观察点：`tool-card-views.tsx`、聊天宿主 container 和 Markdown renderer 已接近文件预算，后续新增职责应优先沿现有 seam 拆分。

## NPM 包发布记录

本次未发布 NPM 包。

需要进入后续统一发布：

- `@nextclaw/agent-chat-ui`：patch，连续工具活动分组、共享 process 行、状态/字符数、连线、终端与文件概览增强。
- `@nextclaw/ui`：patch，过程摘要、i18n 状态文案、skill 引用打开与宿主接入。
