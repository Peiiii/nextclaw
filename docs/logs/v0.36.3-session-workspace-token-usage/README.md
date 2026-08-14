# v0.36.3 会话工作台 Token 用量与子会话入口

## 迭代完成说明

- 会话工作台概览在子会话、定时任务和项目文件入口之后新增 Token 用量区，统计当前会话自身的 AI 运行，并按实际生效模型展示输入、输出、缓存输入、总 Token、运行次数和缓存命中率。
- kernel 以当前消息投影中的 `ai_execution` 元数据为唯一统计来源，按 `runId` 去重、排除从父会话继承的历史消息，并保留 `reported`、`partial`、`unavailable` 三种数据完整度。
- OpenAI 风格用量沿用“缓存输入包含在输入 Token 中”的合同；Anthropic 风格用量在 producer 侧把基础输入、缓存读取和缓存写入归一为完整输入，缓存命中率统一为“缓存读取 / 全部输入”。
- 新增 `/api/ncp/sessions/:sessionId/usage`，并打通 kernel、server、client SDK、UI query 与会话实时更新后的缓存失效链路。
- 子会话管理页标题区新增“新建子会话”入口，直接复用现有侧边对话草稿链路；发送第一条消息时才物化真实子会话并继承父会话上下文，不创建空会话。

## 测试/验证/验收方式

- `@nextclaw/core`、`@nextclaw/ncp-agent-runtime-next`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` 的匹配范围 `tsc` 全部通过。
- core、runtime、kernel、server、client SDK 和 UI 的定向测试共 69 个用例通过，覆盖 Anthropic 缓存用量归一、会话聚合与去重、接口编码/404、query cache 失效、概览顺序、分模型展示、失败重试和新建子会话入口。
- 相关 package lint 均为 0 error；剩余 warning 为本次范围外的历史文件预算提示。
- diff-only maintainability 检查覆盖 27 个触达文件，最终为 0 error；统计聚合、Token 区和子会话管理页均已拆到独立 owner。
- 在 `http://127.0.0.1:5174` 真实开发页面完成冒烟：确认概览顺序为“子会话 → 定时任务 → 项目文件 → Token 用量”，真实会话显示 `39,240` 总 Token、`39,040` 缓存输入、`99.7%` 缓存命中率，并确认“新建子会话”进入可输入的侧边对话草稿。

## 发布/部署方式

- 本次仅创建本地 Git 提交，不执行 push、NPM 发布、runtime channel 更新、桌面构建、部署或宿主重启。
- 用户可见变化由 `.changeset/session-workspace-usage-and-child-creation.md` 记录，后续随正式发布批次统一进入 changelog。

## 用户/产品视角的验收步骤

1. 打开一个已有 AI 回复的会话，进入右侧会话工作台“概览”。
2. 确认子会话、定时任务和项目文件三个常用入口仍位于前面，Token 用量位于概览最后。
3. 检查 Token 总量、输入、输出、缓存输入、缓存命中率和 AI 运行次数，并确认不同模型分别展示自己的统计。
4. 进入“子会话”管理页，确认标题区始终可见“新建子会话”按钮，空列表时也可使用。
5. 点击“新建子会话”，确认打开继承父会话上下文的侧边对话草稿；发送第一条消息后才创建真实子会话。

## 可维护性总结汇总

- 本次沿 NCP 主链路建设，没有新增 legacy 统计或第二套子会话创建路径；kernel 持有会话统计语义，server 与 SDK 仅做薄传输，UI 只负责查询和展示。
- 初次实现使 `session.manager.ts` 越过文件预算，审查后将聚合逻辑收敛到 `session-token-usage.manager.ts`；Token 概览和子会话管理页也进入各自子目录，主工作台组件比改动前减少约 40 行。
- 自动维护性检查曾发现文件和目录预算阻塞，返工后归零；主观复核未发现重复 owner、隐藏 fallback、无收益 wrapper 或并行状态真相源。
- 新增文件均通过 planned-path preflight，目录平铺度没有继续恶化。

## NPM 包发布记录

- 本次不执行 NPM 发布。
- 以下包已有 patch changeset，当前代码均为未发布状态，待后续统一发布：
  - `@nextclaw/core`
  - `@nextclaw/ncp-agent-runtime-next`
  - `@nextclaw/kernel`
  - `@nextclaw/server`
  - `@nextclaw/client-sdk`
  - `@nextclaw/ui`
