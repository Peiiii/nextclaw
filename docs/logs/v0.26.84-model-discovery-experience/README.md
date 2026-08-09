# v0.26.84 模型发现体验与开发决策分流

## 迭代完成说明

本批修复聊天模型选择器中“发现 N 个新模型”提示难以看到的问题，并把讨论过程中验证有效的设计决策方式固化到默认开发流程。

根因是新模型摘要与完整新增模型列表都被放进了已配置模型的滚动容器末尾：模型较多时摘要会随内容滚走，只在固定的“管理模型与提供商”底栏上方露出一小截；继续在约 340px 的选择器弹层里展开跨提供商目录，也混淆了“快速切换模型”和“管理新增模型”两个任务。DOM 层级、组件测试与用户截图共同确认了这一点。

修复后，模型选择器只负责搜索和切换已配置模型；新模型摘要固定在底部操作区，点击后先关闭小弹层，再打开独立的大尺寸模型目录。目录支持搜索、按提供商筛选、逐项添加、添加成功态、忽略本批提醒与明确完成退出，移动端使用接近全屏的可用高度。开发环境新增 `?preview=model-discovery` 预览开关，注入 15 个非持久化示例模型；预览添加和忽略均不更新 provider，也不写提醒 localStorage。

默认开发 workflow 同步增加设计分流：现有合同明确指向唯一明显占优路径时直接实现；存在会实质改变用户体验、owner、复杂度、可逆性或验证成本的设计空间时，先比较 2-4 个真实候选并冻结推荐方案，再进入实现。该规则不要求简单任务仪式化列方案，也不要求证据充分时停下来等待用户确认。

## 测试/验证/验收方式

- `@nextclaw/ui` 定向测试：模型目录 hook 与 toolbar view model 共 21 条通过，覆盖真实添加、真实忽略、15 项预览生成，以及预览添加/忽略零 provider 写入、零 localStorage 写入。
- `@nextclaw/agent-chat-ui` 定向测试：模型选择器与目录交互 6 条通过，覆盖摘要脱离滚动区、大窗口打开、搜索、分组、添加成功态和忽略关闭。
- `pnpm -C packages/nextclaw-ui tsc` 与 `pnpm -C packages/nextclaw-agent-chat-ui tsc` 通过。
- 全部触达 TypeScript/TSX 文件的 targeted ESLint 为 0 error、0 warning。
- `pnpm check:skill-progressive-loading` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 用户已在运行中的源码开发实例通过 `http://127.0.0.1:5174/chat?preview=model-discovery` 完成实际视觉与交互验收，并明确反馈验证通过。

## 发布/部署方式

本批只提交源码、测试、双包 patch changeset、开发流程规则和迭代记录；不执行 NPM 发布、线上部署、宿主重启或桌面打包。开发实例通过既有 Vite 热更新完成预览。

## 用户/产品视角的验收步骤

1. 在真实目录存在新增模型时打开聊天模型选择器，确认“发现 N 个可添加的新模型”固定显示在模型列表下方、“管理模型与提供商”上方。
2. 滚动已配置模型列表，确认摘要和底部管理入口始终可见。
3. 点击“查看”，确认小弹层关闭并出现大尺寸模型目录；使用搜索与提供商标签过滤模型。
4. 点击“添加”，确认按钮显示“已添加”且当前会话模型不会自动切换；点击“忽略这批提醒”后目录关闭。
5. 开发环境可在聊天 URL 后附加 `?preview=model-discovery` 重复完整流程；确认预览操作不改变真实 provider 配置，移除参数后恢复真实目录状态。

## 可维护性总结汇总

本批复用了共享 Dialog primitive、既有模型发现 producer 与 provider 更新主链，没有新增页面路由、第二套模型状态或持久化 owner。小弹层只新增目录打开状态和焦点恢复编排，搜索、分组、pending 与预览状态分别留在模型目录组件和目录 hook 的最近 owner。

自动 maintainability guard 为 0 error，保留一条 `chat-input-bar-toolbar.tsx` 443/500 行的近预算 warning。主观复核认为新增目录主体已经位于独立的 model-discovery 组件，工具栏仅增加必要的弹层/弹窗切换编排；此时继续拆文件会增加名字和跳转而不减少真实复杂度，因此结论为无可维护性发现。目录与文件 planned-path preflight、skill 渐进加载和治理 ratchet 均通过。

## NPM 包发布记录

本提交不立即发布 NPM。用户可见变化已有 `.changeset/model-discovery-dialog.md`：

- `@nextclaw/agent-chat-ui`：patch，待统一发布。
- `@nextclaw/ui`：patch，待统一发布。

开发流程规则、测试和迭代记录本身不进入用户 changelog。
