# v0.23.5 聊天交互一致性

## 迭代完成说明

本轮完成 Linear NC-123 的聊天交互修复与增强：

- 根因一：输入组件同时依赖本地状态与渲染 fallback，目标会话 metadata 异步到达时没有重新以该会话偏好同步，导致模型按钮保留上一会话值。修复后由输入状态 owner 在 session key 变化和 metadata 到达两个阶段统一恢复模型与思考等级。
- 根因二：NCP manager 的错误状态只有写入路径，没有发送前清理 mutation，重试时旧错误会继续显示。修复后在有效发送开始前由 runtime 调用 manager `clearError`。
- 根因三：共享输入 item contract 缺少图标语义，`/` 与 `@` 的命令、Panel App、Skill 无法由统一菜单区分展示。修复后由 plugin 赋值、共享菜单统一渲染。
- 折叠侧栏的会话切换器复用现有“时间 / 项目”模式：时间模式显示轻量静态标题，项目模式显示 Folder、数量和 Chevron，并共享既有项目折叠状态。
- 技能选择器固定自适应高度，搜索结果变化时不再跳变，并支持直接筛选 NextClaw、全局和内建技能。
- `AGENTS.md` 新增运行实例保护规则：没有用户知情同意不得擅自重启，优先热更新、页面刷新或隔离进程验证。
- 稳定 owner 与数据流记录在 `docs/designs/2026-07-15-chat-interaction-consistency.design.md`。

## 测试/验证/验收方式

- `@nextclaw/agent-chat-ui` 定向测试：4 个文件、44 项通过。
- `@nextclaw/ui` 定向测试：会话偏好、NCP 重试、折叠分组、输入 plugin 与会话输入共 7 个文件、26 项通过；Header 分组专项 9 项通过。
- `@nextclaw/ncp-toolkit` conversation state manager 定向测试：19 项通过。
- `@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的定向 `tsc` 通过。
- 五个相关包 package lint 均无 error；本次触达文件无 warning。未触达的历史 warning 包括 `cron-config.tsx` 复杂度、NCP reasoning flush、toolkit 既有测试文件长度与 reply consumer 参数读取。
- `pnpm -C packages/nextclaw-ui build`：通过；构建后的生成物已用 `pnpm clean:generated` 清理，`pnpm check:generated-clean` 通过。
- `pnpm lint:new-code:governance`：通过，保留一条 NCP toolkit 历史目录 warning；`pnpm check:governance-backlog-ratchet`：通过。
- 合并阻塞修复：拓扑 JSONC reader 不再把路径别名字符串 `"@/*"` 误判为块注释；回归测试与 `pnpm report:topology -- --top 50` 均通过。
- 隔离浏览器验收使用 `http://127.0.0.1:5176`，代理现有 `127.0.0.1:18792` 后端，未重启 5174/18792 或其它现有进程。
- 模型恢复：同一 UI 内从 `DeepSeek/deepseek-v4-flash` 会话切到 `MiniMax/MiniMax-M3` 会话，模型按钮正确恢复为目标偏好。
- 技能选择器：有结果和无结果时面板高度均为 `309.0625px`；来源按钮显示全部 87、NextClaw 35、全局 34、内建 18，并可筛到内建技能。
- 折叠会话弹层：真实数据在时间模式按今天、昨天、近 7 天、更早显示轻量静态标题；切到项目模式后显示 `nextbot` 项目组、数量和 Chevron，点击后从“收起项目”变为“展开项目”，组内会话隐藏。
- `/`、`@` 图标由共享组件测试与消费端 Vite 源码加载证明；浏览器自动化输入事件未触发实际弹层，因此不声明这一路径已完成可见手势验收。
- 旧错误清理由 assembled React/NCP manager 测试证明；为避免影响正在运行的实例，没有人为制造真实网络故障。

## 发布/部署方式

本轮先提交隔离分支并创建 Ready PR；用户随后明确要求直接合并，因此继续合入远端 `master`。不执行 NPM 发布、runtime update、桌面发布、部署或 migration。现有 NextClaw 运行实例未重启，本地含未提交改动的主工作区也不自动拉取远端变更。

## 用户/产品视角的验收步骤

1. 打开聊天页，在两个配置了不同 preferred model 的会话间切换，确认模型按钮随目标会话变化。
2. 让一次发送出现错误后重新发送，确认旧错误在新请求开始时消失。
3. 在输入框使用 `/` 与 `@`，确认命令、Panel App、Skill 条目显示不同图标。
4. 收起侧栏并打开标题处的会话切换器，确认时间模式的置顶与日期分组使用轻量静态标题；切换到项目模式后，点击项目右侧 Chevron，确认项目组可折叠和恢复。
5. 打开技能选择器，搜索无结果后确认面板高度不跳变；点击“内建技能”确认可直接浏览内建来源。

## 可维护性总结汇总

- 会话偏好继续复用既有 resolver，未增加第二套 model fallback；输入组件同时净减旧 fallback 分支。
- NCP 错误状态仍由 manager 单一 owner 管理，runtime 只调用明确 mutation。
- 输入图标只扩展共享 item contract，宿主 plugin 不复制图标 JSX。
- 折叠与展开侧栏继续复用同一个 session grouping owner、列表模式与项目折叠状态；时间分组不引入无必要的展开状态。
- 技能来源筛选复用既有 groups，不复制技能 registry。
- 已把技能面板专项验证从历史超限综合测试移到独立角色测试，避免继续扩大热点文件并消除重复用例。
- 拓扑治理修复只收紧整行块注释的匹配边界，并用独立回归测试锁定字符串内注释标记语义，没有引入新的解析 owner 或运行时依赖。
- `post-edit-maintainability-guard`：通过，检查 28 个文件，0 error、3 个历史热点 warning。
- 代码增减报告：新增 825 行、删除 197 行、净增 628 行；非测试代码新增 553 行、删除 176 行、净增 377 行。本轮包含新的用户可见时间/项目分组、项目折叠、来源筛选和公共输入图标 contract，正增长属于功能交付；实现已复用现有 resolver、manager、group 和 plugin owner，没有引入平行链路。
- 合并阻塞补丁另检查 2 个文件，新增 37 行、删除 1 行；非测试代码新增 1 行、删除 1 行、净增 0，0 error、0 warning。
- 主观复核结论：通过，no maintainability findings。本次顺手减债包括删除输入组件的并行 fallback、移除技能选择器的 effect 状态修补、把重复面板测试移出历史热点并让该文件净减 15 行；Header 分组展示已拆到独立展示组件，使标题切换 owner 退出 500 行热点预警。

## NPM 包发布记录

本轮包含用户可见行为和公共 contract 变更，已新增 changeset，以下包均需 patch 且当前未发布，状态为待统一发布：

- `@nextclaw/ncp@0.7.3`
- `@nextclaw/ncp-toolkit@0.6.4`
- `@nextclaw/ncp-react@0.5.4`
- `@nextclaw/agent-chat-ui@0.6.5`
- `@nextclaw/ui@0.15.5`
