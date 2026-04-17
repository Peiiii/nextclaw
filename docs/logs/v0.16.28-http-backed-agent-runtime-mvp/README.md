# v0.16.28 HTTP-Backed Agent Runtime MVP

## 迭代完成说明

本次在原有通用 `http-runtime` MVP 基础上，继续补齐了首个真实接入者 `Hermes` 的独立 adapter server。最终交付不再只是“通用桥接层”，而是已经包含“通用 runtime + plugin + Hermes adapter”这条完整接入链。

本次交付包含：

- 新增纯 runtime 包 `@nextclaw/nextclaw-ncp-runtime-http-client`
- 新增 plugin 包 `@nextclaw/nextclaw-ncp-runtime-plugin-http-client`
- 新增 `http-runtime` session type 注册、基础 ready/probe 描述与 UI config schema
- 新增 `createUiNcpAgent` 级别的集成测试，验证 runtime 能被列出、能执行消息并把结果落盘
- 新增独立 Hermes adapter 包 `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http`
- 新增 Hermes adapter CLI，可直接启动本地 bridge server
- 新增 Hermes adapter 自动化测试，覆盖会话连续性、`stream` 先于 `send` 的竞态，以及 `/abort` 对上游流的中断
- 新增 `createUiNcpAgent` + Hermes adapter 集成测试，验证通用 `http-runtime` 可以通过 Hermes adapter 落盘消息
- 同批次续改：当 Hermes 上游以“空 completion + stop”形式吞掉 provider 失败时，adapter 现在会把这类结果显式映射为 `message.failed` / `run.error`，不再让 NextClaw 前端看到“空回复但像是成功结束”的假阳性
- 同批次续改：修复 `http-runtime` 在收到远端 `run.finished` 后过早 `stop()` 导致 Node fetch/SSE 读流 promise 不 settle、会话长期卡在 `running` 的问题；现在正常完成时会等待远端 stream 自然收口，用户可见结果是 `Hermes` 会话真实回复后会回到 `idle`
- 同批次续改：修复 Hermes adapter 对 reasoning / tool-call 语义的丢失问题。现在 adapter 默认会把 `<think>...</think>` 正规化成 `message.reasoning-delta`，并且最终 `message.completed` 里的 assistant `parts` 会保留 reasoning 与 `tool-invocation`，不再退化成只剩纯 text
- 同批次续改：补齐 Hermes 内联工具痕迹到标准 NCP tool-invocation 的翻译。由于真实 Hermes + MiniMax 链路并不稳定返回标准 OpenAI `tool_calls`，而是会把 `🔎 *.py` / `💻 ls -1` 这类工具动作内联进文本流；adapter 现在会把这些内联痕迹翻译成 `message.tool-call-start/args/end`，并在最终 assistant `parts` 中保留 `tool-invocation`
- 同批次续改：补齐“工具调用之后再次出现 `<think>`”的真实链路收尾。Hermes adapter 现在会在内联工具翻译之后再做一层 reasoning 归一化，因此工具调用后的 `<think>...</think>` 不会再残留进最终 `text` part，而会继续落成标准 `message.reasoning-delta`
- 同批次续改：给 `nextclaw-ncp-runtime-plugin-http-client` 增加 `openclaw.development.extensions`，这样 `pnpm dev:plugin:local` 对它会真正使用 `sourceMode: development`，不再只是本地链接构建产物
- 同批次续改：修复 `http-runtime` session type 在 observation 模式下对 Hermes adapter 的“假 ready”问题。现在只要配置了 `healthcheckUrl` 且 `capabilityProbe` 未关闭，`describeSessionType` 在普通列表场景也会真实探活；当 adapter 不可达时，前端不再显示可选的 `ready=true`
- 新增实现计划文档与设计文档，供后续 Hermes adapter server 对接继续复用

相关文档：

- 这批早期 HTTP runtime 设计/施工计划文档已在后续 ACP 主链收口时删除，避免继续误导读者回到已废止的 plugin/API-server-first 心智
- 当前 Hermes stdio 主链请以 [Hermes ACP RuntimeRoute Bridge Design](../../plans/2026-04-17-hermes-acp-runtime-route-bridge-design.md) 为准

明确仍未做的范围：

- 未实现“多个 http-runtime 实例”的产品级管理面
- 未新增 skill 分发/安装体验
- 未改动现有 runtime registry 的 `kind` 唯一模型
- 未把真实 Hermes 上游 provider 凭据配置产品化成本地一键 setup

## 测试/验证/验收方式

已执行并通过：

- `pnpm install`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client test`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client test`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http lint`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http test`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http build`
- `pnpm -C packages/nextclaw test -- create-ui-ncp-agent.http-runtime.test.ts`
- `pnpm -C packages/nextclaw test -- create-ui-ncp-agent.hermes-http-runtime.test.ts`
- `pnpm -C packages/nextclaw tsc`

本次续改额外执行并通过：

- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http test`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http lint`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http build`
- `pnpm -C packages/nextclaw test -- create-ui-ncp-agent.hermes-http-runtime.test.ts`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client test`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client build`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http test`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client test`
- `pnpm -C packages/nextclaw-ui test -- src/components/chat/containers/chat-message-list.container.test.tsx`
- `pnpm -C packages/nextclaw test -- create-ui-ncp-agent.http-runtime.test.ts`
- `pnpm dev:plugin:local -- --plugin-path ./packages/extensions/nextclaw-ncp-runtime-plugin-http-client --session-type http-runtime --source-config <temp-config> --json`
- `pnpm smoke:ncp-chat -- --session-type http-runtime --model minimax/MiniMax-M2.7 --port 18792 --prompt 'Reply exactly OK' --json`
- `pnpm smoke:ncp-chat -- --session-type http-runtime --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18834 --prompt 'Reply exactly OK' --json`
- `pnpm smoke:ncp-chat -- --session-type http-runtime --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18834 --prompt 'Use your search_files tool to find the first 3 Python files in the current workspace and tell me the paths only.' --json`
- `pnpm -C packages/nextclaw-ui test -- src/components/chat/containers/chat-message-list.container.test.tsx src/components/chat/ncp/ncp-session-adapter.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`

已执行并确认链路可达，但受本机 Hermes 上游凭据限制未能拿到成功文本回复：

- 启动真实 Hermes API server：`HERMES_HOME=/tmp/nextclaw-hermes-real-YOWkG0 API_SERVER_ENABLED=true API_SERVER_KEY=nextclaw-hermes-smoke API_SERVER_PORT=18642 uv run python -m gateway.run`
- 探活真实 Hermes：`curl http://127.0.0.1:18642/health`
- 探活真实 Hermes models：`curl http://127.0.0.1:18642/v1/models -H 'Authorization: Bearer nextclaw-hermes-smoke'`
- 启动真实 Hermes adapter：`node packages/nextclaw-ncp-runtime-adapter-hermes-http/dist/cli.js --host 127.0.0.1 --port 18765 --hermes-base-url http://127.0.0.1:18642 --api-key nextclaw-hermes-smoke`
- 真实 adapter 直连验证：确认 `/send` `/stream` 能拿到 `endpoint.ready,message.accepted,run.started,message.completed,run.finished`
- 真实 NextClaw 入口验证：确认 `createUiNcpAgent` 可列出 ready 的 `http-runtime`/`Hermes` session type，并能把真实 Hermes 运行错误回流为 `run.error`

本次续改额外确认：

- 真实 Hermes `/v1/chat/completions` 在当前本机凭据下会返回 `HTTP 200 + 空 completion + [DONE]`，但 Hermes 自身日志明确记录上游 provider `HTTP 403`：`用户没有有效的claudecode订阅`
- 修复前，NextClaw 前端同链路会收到 `message.completed` / `run.finished`，但 assistant 文本为空，表现为“像成功结束但没有回答”
- 修复后，NextClaw 前端同链路会收到 `message.failed` / `run.error`，错误文案为 `Hermes completed without any assistant content...`，不再把这类空 completion 误判成成功
- 在当前本机 `MiniMax` 凭据下，`NextClaw -> http-runtime -> Hermes adapter -> Hermes gateway -> MiniMax` 已真实跑通成功回复；`pnpm smoke:ncp-chat` 返回 `assistantText` 末尾为 `OK`，terminal event 为 `run.finished`
- 修复前，真实 `http-runtime` 会话虽然已能落库 assistant 文本，但 session summary 会长期停留在 `status: "running"`，导致 smoke/前端收尾体验不完整
- 修复后，真实 `http-runtime` 会话会正常回到 `status: "idle"`；包括此前历史上卡住的 `test-nextclaw-1776271925032`、`smoke-http-runtime-mo0a8r1n-ay2dubew` 等会话在重启并复测后也已恢复为 `idle`
- 在当前本机 `MiniMax` 凭据下，直连 adapter 的真实 SSE 已能看到 `message.reasoning-delta -> message.text-delta -> message.completed -> run.finished`，且 `message.completed.payload.message.parts` 现在包含独立 `reasoning` part 与 `text` part
- 在当前本机 `MiniMax` 凭据下，`pnpm smoke:ncp-chat` 现在会返回 `assistantText = "OK"`、`reasoningText = "The user wants me to reply with exactly \"OK\". This is a simple request."`，说明 reasoning 已经不再混进最终可见文本
- 本次续改新增 Hermes adapter 自动化覆盖：
  - think-tags -> `message.reasoning-delta` + 最终 `reasoning/text` parts
  - tool_calls delta -> `message.tool-call-*` + 最终 `tool-invocation` part
- 本次续改再补一条真实联调结论：
  - 当前 Hermes + MiniMax 真机链路里，工具动作经常不会以标准 OpenAI `tool_calls` 回流，而会以内联文本痕迹出现，例如 `` `🔎 *.py` `` / `` `💻 ls -1` ``
  - 修复后，`pnpm smoke:ncp-chat -- --session-type http-runtime --model minimax/MiniMax-M2.7 --port 18792 --prompt 'Use your search_files tool to find the first 3 Python files in the current workspace and tell me the paths only.' --json` 的真实 `eventTypes` 已包含 `message.tool-call-start`, `message.tool-call-args`, `message.tool-call-end`
  - 同一真实会话 `smoke-http-runtime-mo0d6bz3-wry39sxp` 的落库 assistant message `parts` 已包含 `{ type: "tool-invocation", toolName: "search_files", args: "{\"pattern\":\"*.py\"}" }`
- 本次收尾再补一条浏览器真实入口验证：
  - 直接对 NextClaw 前端实际使用的 `POST /api/ncp/agent/send` + `GET /api/ncp/agent/stream` 进行了本地联调，而不是只验证 adapter 内部接口
  - 真实 `eventTypes` 已包含 `message.tool-call-start`, `message.tool-call-args`, `message.tool-call-end`, `message.completed`, `run.finished`
  - 同一会话的 `GET /api/ncp/sessions/:sessionId/messages` 返回里，assistant `parts` 仍保留 `tool-invocation`
  - 前端回归测试已补上：Hermes assistant 消息中的 `tool-invocation` 会被 UI 转成 `tool-card`，不会再被折叠成普通文本
- 本次收尾再补一条开发态源码验证：
  - `pnpm dev:plugin:local` 对 `nextclaw-ncp-runtime-plugin-http-client` 的输出已明确为 `sourceMode: "development"`，说明本地产品服务加载的是插件源码入口，而不是旧的 dist 构建产物
  - 在这个真实开发态服务上，`GET /api/ncp/session-types` 已返回 `http-runtime/Hermes ready=true`
  - 同一开发态服务上，`Reply exactly OK` 冒烟已真实返回 `assistantText = "OK"`、`terminalEvent = "run.finished"`、session 最终状态为 `idle`
  - 同一开发态服务上，工具调用冒烟已真实返回 `message.tool-call-start`, `message.tool-call-args`, `message.tool-call-end`, `message.completed`, `run.finished`
  - 同一工具调用会话 `GET /api/ncp/sessions/:sessionId/messages` 返回中，assistant `parts` 现为 `reasoning + tool-invocation + reasoning + text`，最终 `text` part 已不再包含 `<think>` 标签
- 本次收尾再补一条 `pnpm dev start` 产品入口验证：
  - 真实 `pnpm dev start` 服务 `http://127.0.0.1:18792` 下，当前 Hermes plugin 配置使用 `http://127.0.0.1:18765`
  - 当 `18765` 上 Hermes adapter 缺失时，真实会话会复现 `run.error = "fetch failed"`；这就是用户在前端里看到的现象
  - 把 Hermes adapter 补起到 `18765` 后，`pnpm smoke:ncp-chat -- --session-type http-runtime --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18792 --prompt 'Reply exactly OK' --json` 已真实通过
  - 同一 `pnpm dev start` 服务下，工具调用冒烟同样真实通过，事件流已包含 `message.tool-call-start`, `message.tool-call-args`, `message.tool-call-end`
  - 这轮问题也暴露出 session type 列表的 observation 模式此前会误报 `ready=true`；修复后，adapter 不可达时前端应直接看到 `ready=false / healthcheck_unreachable`，不再被误导去创建必然失败的 Hermes 会话
- 真实验证接口包括：
  - `GET http://127.0.0.1:<nextclaw-port>/api/ncp/session-types`
  - `POST/GET http://127.0.0.1:<nextclaw-port>/api/ncp/agent/*`
  - `GET http://127.0.0.1:<nextclaw-port>/api/ncp/sessions/:sessionId/messages`

真实联调受限原因：

- 本机可用的 Hermes 上游 provider 凭据会让真实 Hermes 返回 `401 invalid api key` 或 `403 Request not allowed`
- 因此“真实 Hermes 成功生成文本”没有在本机凭据条件下跑通
- 但这不影响“NextClaw -> http-runtime -> Hermes adapter -> Hermes API server”链路本身已真实连通；成功文本路径已由 mock-Hermes 自动化测试覆盖

已执行但未通过，且失败原因不属于本次新增文件本身：

- `pnpm lint:new-code:governance`
  失败原因是当前工作树里已有多处其它已触达文件仍不满足仓库的后缀命名治理要求，例如 `packages/nextclaw/src/cli/commands/agent/cli-agent-runner.ts`、`packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-tool-registry.ts` 等；在我把本次新增文件命名修正后，报错列表里已不再包含本次新增文件。
- `pnpm check:governance-backlog-ratchet`
  失败原因是仓库当前 `docFileNameViolations` 为 `13`，高于 baseline `11`，属于本次之外的现存工作树/基线问题。
- `pnpm lint:maintainability:guard`
  本次续改后，Hermes adapter 自身的文件预算错误已收敛；当前剩余 error 来自其它已触达文件的现存问题，例如 `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx` 超出预算，以及 guard 后续串行执行时仍会被仓库级 `docFileNameViolations` baseline 问题阻断。

## 发布/部署方式

本次是仓库内能力接入，不涉及独立线上发布流程。启用方式如下：

1. 启动 Hermes API server，例如：

```bash
HERMES_HOME=/path/to/hermes-home \
API_SERVER_ENABLED=true \
API_SERVER_KEY=change-me \
API_SERVER_PORT=8642 \
uv run python -m gateway.run
```

2. 启动 Hermes adapter：

```bash
node packages/nextclaw-ncp-runtime-adapter-hermes-http/dist/cli.js \
  --host 127.0.0.1 \
  --port 8765 \
  --hermes-base-url http://127.0.0.1:8642 \
  --api-key change-me
```

3. 在 NextClaw 配置里启用 plugin，例如：

```json
{
  "plugins": {
    "load": {
      "paths": ["../extensions/nextclaw-ncp-runtime-plugin-http-client"]
    },
    "entries": {
      "nextclaw-ncp-runtime-plugin-http-client": {
        "enabled": true,
        "config": {
          "label": "Hermes",
          "baseUrl": "http://127.0.0.1:8787",
          "basePath": "/ncp/agent",
          "recommendedModel": "hermes/default"
        }
      }
    }
  }
}
```

4. 若希望在 session type 列表里做主动探测，可额外配置 `healthcheckUrl` 指向 adapter 的 `/health`。

## 用户/产品视角的验收步骤

1. 启动 Hermes API server。
2. 启动 Hermes adapter server。
3. 在 NextClaw 中启用 `nextclaw-ncp-runtime-plugin-http-client`，并把 `baseUrl` 指向 Hermes adapter。
4. 打开支持 NCP session type 的入口，确认 session type 列表里出现 `Hermes` / `HTTP Runtime` 且显示 ready。
5. 新建一个 `http-runtime` 会话并发送消息。
6. 正常情况下，assistant 文本应流式返回并落到会话历史中，session summary 最终回到 `idle`，而不是长期卡在 `running`。
7. 若上游输出 `<think>` 或 tool-calls，这些语义应以独立 reasoning / tool-invocation parts 保留下来，而不是被揉进纯文本或直接丢失。
8. 若 Hermes 上游把工具动作以内联文本痕迹返回而不是标准 `tool_calls`，前端仍应看到标准 `tool invocation` 记录，而不是只看到一段普通文本。
9. 若 Hermes 上游 provider 凭据无效，NextClaw 侧应能收到明确的运行错误，而不是无响应卡死。

## 可维护性总结汇总

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

代码增减报告：

- 新增：约 4012 行
- 删除：0 行
- 净增：约 +4012 行

说明：这里按本批次最终落地范围估算，包含通用 runtime/plugin、Hermes adapter、测试与相关文档。由于本批次文件当前仍处于未提交状态，数字以当前文件行数估算为准。

非测试代码增减报告：

- 新增：约 1962 行
- 删除：0 行
- 净增：约 +1962 行

说明：这里按实现代码/配置口径估算，排除了测试文件，也不把本次设计/计划文档计入“非测试代码”。

no maintainability findings

独立复核后的判断如下：

- 本次是否已尽最大努力优化可维护性：是。本次继续沿用了“通用 runtime + 独立 adapter”的边界，没有把 Hermes 私有实现倒灌到主 runtime/plugin，也没有为了追求“一次性完成”去把 skill 分发、多实例管理、UI 管理面一起硬塞进来。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然总代码继续净增长，但相比“在主仓库做 Hermes 专属 runtime”这条路线，现在的增长更集中、更可替换，也减少了未来接第二个外部 runtime 时重复造轮子的概率。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：没有做到净下降；但增长已收敛到最小必要新增。新增主要集中在一个独立 adapter 包和一条真实 Hermes 集成测试，没有把复杂度继续摊平到更多已有核心文件里。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。Hermes adapter 的会话映射、SSE 解析、HTTP 路由与 CLI 启动职责被收敛在单独包内；NextClaw 主体仍只感知 `http-runtime` 和标准 NCP transport。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增文件本身已按当前治理要求调整后缀；仓库级治理检查仍被其它已触达历史文件阻断，这些问题不属于本次新增文件。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。本节结论基于实现后独立复核，判断重点是“是否把外部 runtime 接入做成了稳定边界”，而不是只看 lint/guard。

本次续改补充判断：

- 本次是否已尽最大努力优化可维护性：是。本轮没有继续为 Hermes 私有失败模式加特殊 runtime 分支，而是仅在 adapter 内补了一条“空 completion 视为错误”的明确边界。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本轮只新增了最小必要判断与两层回归测试，没有扩出新的协议字段、状态机或 fallback 分支。
- 若总代码或非测试代码净增长：本轮续改属于最小必要净增长，主要是错误语义判断与回归测试；非测试代码增长集中在 Hermes adapter 内一处判断，没有把复杂度扩散到 NextClaw 主链路。
- 本轮再补一层判断：是。本次真实联调收尾没有去改 Hermes adapter 协议，也没有给 NextClaw 增加新的隐藏兜底，而是把问题收敛到 `HttpRuntimeRunController` 的正常完成收尾策略里，只改一处 owner 逻辑并补一个专门覆盖“terminal event 已到但 stream 晚一点才真正关闭”的回归测试。
- 本轮再补一层判断：是。关于 reasoning / tool-call 透传，没有去发明新的私有事件类型或在前端加猜测式补丁，而是直接修 Hermes adapter 对标准 NCP 事件和最终 `parts` 的保真度，让“流式事件”和“最终消息对象”两层语义重新一致。

后续最值得继续推进的维护性切口：

- 若未来要支持多个 `http-runtime` 实例，应优先在 runtime instance 管理模型上做正式设计，而不是继续往单一 `http-runtime` kind 上叠更多隐式配置。
- 若未来发现不同 adapter 对“先 stream 再 send”的时序约束不一致，应优先补一个显式 attach/probe 协议，而不是在客户端继续加隐式时序补丁。
