# 聊天错误单一展示与全文保留

## 迭代完成说明

- 根因一：会话失败活动摘要由对话区渲染，同时 `lastSendError` 又被合并进输入框 `sendError`，同一供应商错误因此进入两个并行展示 owner。
- 根因二：OpenAI-compatible HTTP 边界先把非成功响应截成 200 字符写入 `Error.message`，会话活动投影又把错误截成 160 字符；Anthropic、Responses 解析与 Codex SDK / Claude Code SDK 上游桥接也存在同类 240 字符截断。截图中的缺失不是纯 UI 省略，而是数据在上游已被不可逆丢弃。
- 确认方式：对照真实失败会话的 UI、会话 API 与 `~/.nextclaw/sessions/.ncp-agent-journal` 元数据，旧错误正文长度为 159 字符；随后定位 `sse-stream.utils.ts` 与 `session-activity-preview-ncp-event.utils.ts` 的两处截断实现。
- 根因修复：OpenAI-compatible、Responses、Anthropic 与两条 SDK 桥接的供应商响应全文进入诊断错误，会话失败投影也保留全文；聊天页统一选择本地发送错误、运行时错误或会话失败中的一个作为唯一正文；输入框不再渲染同一错误。主错误面改为中性底色、细弱错误边和限高滚动正文，正常消息摘要与显式 `bodyPreview` 调试字段的长度限制保持不变，二者均有独立全文 owner。

## 测试/验证/验收方式

- Core 定向测试：SSE、Responses payload、Anthropic Messages 与 Chat Completions normalizer 共 4 个测试文件、11 项通过，覆盖超过 200/240 字符的原始响应、非 JSON 响应、异常成功载荷与独立 preview 元数据。
- Kernel 定向测试：`session-activity-preview-ncp-event.utils.test.ts`，6 项通过，覆盖字符串错误和结构化错误全文、换行与尾部标记。
- UI 定向测试：会话区、输入区与 controller 共 17 项通过，覆盖重复错误只渲染一次、正文全文、限高滚动和输入框无错误副本。
- Extension 验证：Claude Code SDK 6 个测试文件、11 项通过；Codex SDK 10 个测试文件、33 项通过；两个 package 的 `tsc` 与 lint 均通过。未运行 `pnpm dev:claude` 或重启 extension 进程，因为本次没有获得重启当前开发实例的授权；桥接错误边界由直接 fetch 回放测试覆盖。
- TypeScript：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ui` 的 `tsc` 均通过。
- ESLint：五个触达包均为 0 error；Core 24 条、UI 1 条、Codex SDK 1 条既有 warning 与本次触达行无关，Kernel 与 Claude Code SDK 无 warning。
- 治理：`pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 真实冒烟：使用当前本地源码实例与 `openrouter/qwen/qwen3.8-max` 新建失败会话 `ncp-msj4b4vn-ad1f48cc`。刷新后，持久化 `statusText` 与主错误正文均为 514 字符且逐字一致，正文以完整 JSON 结尾；主区只有一个错误正文，输入框容器不包含错误；正文最大高度 128px，溢出时内部滚动。
- `pnpm check:generated-clean` 未通过：`packages/nextclaw/ui-dist` 在本次任务前后存在大批 hash 资产替换漂移；本次没有运行 UI build，也没有清理或覆盖这些用户工作区产物。

## 发布/部署方式

- 本次源码、测试与本地运行实例热更新验收随本迭代提交；未推送、未部署，也未手工重启 NextClaw 宿主或服务。
- 已添加用户可见修复 changeset，后续进入统一版本化与发布流程。

## 用户/产品视角的验收步骤

1. 选择会返回较长原始错误的任意供应商模型并发送消息。
2. 确认聊天主区只出现一个低干扰错误面，输入框内不再出现第二份错误。
3. 确认错误正文没有数据级截断；内容超过 128px 时可以在错误面内部滚动，并可选择复制全文。
4. 刷新该会话，确认错误全文仍然保留，正文不额外拼接“失败 ·”等展示前缀。

## 可维护性总结汇总

- 使用 `post-edit-maintainability-guard` 的 non-feature 模式检查本次可独立归因的 Core、Kernel、会话区与 SDK bridge 路径：非测试代码 `+48/-59，净减 11`，检查通过。
- `session-conversation-area.tsx` 仍为 413 行，与改动前一致；本次通过删除错误标题/红点的冗余视觉结构、合并失败来源选择与收敛欢迎态 JSX，抵消了单一错误 owner 所需代码。
- `session-conversation-input.tsx` 同时包含工作区既有的模型发现改动，整文件 diff 无法用于本任务独立计数；本任务在该文件仅删除两项输入错误透传，不新增生产分支。
- 没有新增生产抽象、helper、service 或平行状态；正常消息预览和失败诊断正文继续使用各自明确合同。
- 删除 Anthropic 与 SDK bridge 中只提取 message 或截断 raw body 的平行错误路径；Codex bridge request 文件净减 4 行。
- 包内部结构保持现有 L2/L3 feature 与 `utils` 角色落位；新增测试与 SSE 无状态工具同目录，没有新增目录、barrel 或共享层。
- 已执行 `post-edit-maintainability-review`：未发现需要继续修改的 owner、抽象或重复链路问题；会话区文件接近 500 行预算，后续若再扩展应优先从当前容器拆出稳定的视图编排 owner，而不是继续堆局部 helper。

## NPM 包发布记录

- 需要后续统一发布 patch：`@nextclaw/core`（当前 0.15.18）、`@nextclaw/kernel`（当前 0.6.20）、`@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`（当前 0.2.17）、`@nextclaw/nextclaw-ncp-runtime-codex-sdk`（当前 0.2.16）、`@nextclaw/ui`（当前 0.15.21）与 `nextclaw`（当前 0.28.0）。
- 当前状态：均未在本次任务中发布，标记为 `待统一发布`。
