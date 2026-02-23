# 2026-02-23 v0.8.10-weather-query-stall-fix

## 背景 / 问题

- 询问“杭州天气怎么样”时，Agent 进入工具调用链后一直不回复。
- 根因：工具调用连续迭代到上限后，没有生成最终回复，导致直接返回空响应。

## 迭代完成说明（改了什么）

- `@nextclaw/core`：工具调用达到最大迭代次数时，生成兜底回复并附带最后一次工具信息，避免静默。
- 受影响包联动发布：
  - `@nextclaw/core@0.6.29`
  - `@nextclaw/server@0.5.5`
  - `@nextclaw/openclaw-compat@0.1.22`
  - `@nextclaw/channel-runtime@0.1.14`
  - `@nextclaw/channel-plugin-*@0.1.3`
  - `nextclaw@0.8.10`

## 测试 / 验证 / 验收方式

构建/静态检查/类型检查（release:check）：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm release:check
```

说明：lint 有历史遗留 max-lines 警告（无 error）。

冒烟（非仓库目录，强制工具循环并验证兜底回复）：

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-smoke-home.XXXXXX)
TMP_WS=$(mktemp -d /tmp/nextclaw-smoke-ws.XXXXXX)
SCRIPT=$(mktemp /tmp/nextclaw-smoke.XXXXXX.mjs)
cat <<'NODE' > "$SCRIPT"
import { AgentLoop, MessageBus, ProviderManager, LLMProvider } from "file:///Users/peiwang/Projects/nextbot/packages/nextclaw-core/dist/index.js";

class LoopingProvider extends LLMProvider {
  constructor() {
    super(null, null);
    this.calls = 0;
  }

  async chat() {
    this.calls += 1;
    return {
      content: null,
      toolCalls: [
        {
          id: `call-${this.calls}`,
          name: "exec",
          arguments: { command: "echo ok" }
        }
      ],
      finishReason: "tool_calls",
      usage: {}
    };
  }

  getDefaultModel() {
    return "fake";
  }
}

const bus = new MessageBus();
const provider = new LoopingProvider();
const providerManager = new ProviderManager(provider);
const loop = new AgentLoop({
  bus,
  providerManager,
  workspace: process.env.NEXTCLAW_WORKSPACE ?? "/tmp",
  maxIterations: 3,
  execConfig: { timeout: 5 },
  restrictToWorkspace: true
});

const result = await loop.processDirect({
  content: "What's the weather in Hangzhou?",
  channel: "cli",
  chatId: "smoke"
});

console.log(result);
NODE

NEXTCLAW_HOME="$TMP_HOME" NEXTCLAW_WORKSPACE="$TMP_WS" PATH=/opt/homebrew/bin:$PATH node "$SCRIPT"
rm -f "$SCRIPT"
rm -rf "$TMP_HOME" "$TMP_WS"
```

验收点：输出包含 `Sorry, tool calls did not converge...` 的兜底回复。

## 发布 / 部署方式

按 [`docs/workflows/npm-release-process.md`](../../../workflows/npm-release-process.md) 执行：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm release:version
PATH=/opt/homebrew/bin:$PATH pnpm release:publish
```

- 本次不涉及数据库变更，无 migration 需求。

## 用户 / 产品视角的验收步骤

1. 用户询问“杭州天气怎么样”。
2. 即使工具调用未收敛，系统也应返回兜底回复，而不是静默不响应。

## 影响范围 / 风险

- 影响范围：`@nextclaw/core` 及其直接依赖包。
- Breaking change：否。
- 风险：低（仅增加兜底回复）。
