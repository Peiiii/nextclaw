# v0.6.33-input-budget-toolchain-sanitize

## 迭代完成说明（改了什么）

- 修复 `InputBudgetPruner` 在长会话裁剪场景下可能破坏工具调用协议链的问题。
- 新增“历史工具协议净化”逻辑：
  - 清理非活跃历史中的 `tool` 消息；
  - 清理非活跃历史中的 `assistant.tool_calls` 与 `reasoning_content`；
  - 保留尾部活跃工具链（`assistant(tool_calls)` + 对应 `tool`）不被破坏。
- 该修复直接针对 Discord 多 agent 长会话中出现的 `400 Provider returned error` / `INVALID_ARGUMENT`。
- 本次不改配置面，不新增用户参数；使用方式保持不变（见 [`docs/guides/multi-agent-architecture.md`](../../guides/multi-agent-architecture.md)）。

## 测试 / 验证 / 验收方式

### 1) 工程验证（规则要求）

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

结果：全部通过（仅历史 warning，无新增 error）。

### 2) 冒烟验证（协议裁剪关键路径）

本地命令（仅运行，不写仓库数据）：

- `pnpm -C packages/nextclaw-core exec tsx -e "...InputBudgetPruner smoke..."`

观察点：

- `staleToolRemoved: true`
- `staleAssistantToolCallsRemoved: true`
- `activeTailPreserved: true`

### 3) 线上真实链路验证（用户场景）

远端命令：

- `NEXTCLAW_HOME=/root/.nextclaw nextclaw agent -m '烟雾：只回OK' --session 'agent:main:discord:default:direct:733847030283239425' --no-markdown`

观察点：

- 实际返回 `OK`；
- 不再触发 `400 Provider returned error`。

### 用户/产品视角验收步骤

1. 在 Discord 私聊中持续对话并触发多轮工具调用（如配置查询、会话/路由相关请求）。
2. 继续在同一会话发送新消息，确认不会再出现 `Sorry, I encountered an error: Error: 400 Provider returned error`。
3. 验证产品体感：重启前后都能稳定回复，而不是“只能靠重启短暂恢复”。
4. 验证风险边界：多 agent 配置保持原样（`agents.list`、`bindings`、`session.dmScope`）时仍能稳定工作。

通过标准：

- 长会话可持续回复；
- 不再出现工具协议链断裂导致的 provider 400；
- 无需用户更改配置即可生效。

## 发布 / 部署方式

本次发布闭环：

1. 新增 changeset（联动发布）
2. 执行版本提升：`pnpm changeset version`
3. 执行发布：`pnpm changeset publish`
4. 发布后回归：`build/lint/tsc` + 协议裁剪冒烟 + 远端真实会话冒烟

发布说明：

- 本次不涉及后端数据库变更，远程 migration 不适用。
- 本次涉及 CLI/runtime 行为修复，已完成真实链路冒烟。
