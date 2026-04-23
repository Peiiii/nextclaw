# v0.16.94 Tool Result Budget Guard

## 迭代完成说明（改了什么）

- 根因：NCP native agent runtime 只在初始上下文构建阶段执行输入预算裁剪，但同一次 run 内的工具结果会在工具执行后直接追加到下一轮 `role: "tool"` message；截图类 MCP 工具返回的 base64/大 JSON 结果因此绕过预算器，进入下一轮模型请求并触发 `400 invalid params, context window exceeds limit (2013)`。
- 根因确认方式：对本地异常 session 进行 JSONL 扫描，确认 `mcp_chrome_devtools__take_screenshot` 工具结果单次约 108 万字符；再对照 runtime 代码路径，确认 `appendToolRoundToInput` 原先直接 `JSON.stringify(tr.result ?? {})`，而预算裁剪只发生在 context builder 的初始 `prepare` 阶段。
- 修复内容：新增 `ToolResultContentManager`，在工具结果进入 UI 事件、持久化消息状态和下一轮模型输入前统一执行模型可见内容治理；默认单个工具文本结果限制为 10,000 字符，当前模型输入内全部 tool message 合计限制为 60,000 字符，并按 Codex content item 思路把工具结果拆成 `input_text` / `input_image`。MCP image block 不再作为 base64 文本进入上下文，而是作为视觉模型可见的 `input_image` 保留；UI/历史 `result` 只保存图片 `mimeType/detail/originalDataChars/dataOmitted` 摘要，同时对 data URL、base64-like payload、二进制对象、深层/超大数组对象做结构化省略。
- 同步将 `runtime.ts` 收敛为 `agent-runtime.service.ts`，将新 owner 命名为 `tool-result-content.manager.ts`，并把图片识别/摘要下沉到 `tool-result-image.service.ts`，纯序列化/截断工具放到 `tool-result-content.utils.ts`；新增 `src/README.md` 记录当前 package root source surface 的目录预算豁免与后续拆分缝。
- 方案文档：[Tool Result Content Items Design](../../designs/2026-04-23-tool-result-content-items-design.md)。

## 测试/验证/验收方式

- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime test`：通过，5 个测试文件、15 个用例通过。
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`：通过。
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime build`：通过；`tsdown` 提示当前 Node.js `v22.16.0` deprecated，需后续升级到 `22.18.0+`，不影响本次构建结果。
- `pnpm --dir packages/ncp-packages/nextclaw-ncp tsc`：通过。
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-toolkit tsc`：通过。
- `pnpm --dir packages/nextclaw tsc`：通过。
- 真实 AI 验证：构造带小 PNG data URL 的 synthetic screenshot 工具结果，经 `ToolResultContentManager.normalizeToolCallResult` 与 `appendToolRoundToInput` 后发送给真实 `custom-1/gpt-5.4`；请求中存在 `image_url` content part，工具文本摘要为 473 chars，模型回答右侧方块颜色为 `green`，确认模型确实看到图片而不是只读文本摘要。
- `pnpm --dir packages/ncp-packages/nextclaw-ncp-agent-runtime lint`：通过退出码 0；仍报告既有 `user-content.ts` context destructuring warning，本次未触达。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`：通过，0 error；目录预算因 `src/README.md` 已记录豁免降级为 warning。曾额外跑过 `--non-feature`，因本次已从纯止血升级为“工具图片可被模型视觉输入消费”的新增协议能力，非测试净增长硬门槛不适用。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：未通过。阻塞点是 file-role-boundaries 对“触达旧文件必须补角色后缀”的治理要求；本次触达的若干历史文件如 `types/message.ts`、`types/events.ts`、`agent-runtime/tool.ts`、`context-builder.ts`、`nextclaw-ncp-message-bridge.ts` 等原本就不满足新后缀规则。曾评估直接重命名，但会级联触达大量协议/上下文/CLI 模块并把本次需求扩大成仓库级命名迁移，因此本次不扩大处理；另有工作区无关 gateway 测试文件也被同一命令扫描到。

## 发布/部署方式

- 暂未发布；本次仅完成源码修复与本地验证。
- 若进入统一发包，需要发布 `@nextclaw/ncp-agent-runtime`，并由依赖该 package 的上层 CLI/desktop 构建跟随集成。

## 用户/产品视角的验收步骤

- 使用 native NCP agent 触发会产生大截图或大 JSON 的工具调用。
- 观察工具卡片仍能显示可读摘要，但 `result` 不再持久化百万字符级 base64/tool payload；图片本体改由结构化 `resultContentItems/input_image` 承载，后续再收敛到压缩/asset 化策略。
- 继续同一 run 的下一轮模型请求，应看到模型收到的是带 `NextClaw tool result truncated` 标记的安全文本摘要；MCP 图片结果会作为 `input_image` / `image_url` visual observation 进入模型输入，让视觉模型真实看图。
- 长循环多次工具调用时，旧 tool message 会被替换为 `older tool result omitted from active model context`，最新工具结果仍保留足够上下文。

## 可维护性总结汇总

- 本次已尽最大努力优化可维护性：是。核心对外逻辑集中在 `ToolResultContentManager`，runtime 只负责调用，不在主循环中堆特判；图片结构识别拆到 `ToolResultImageService`，避免 manager 继续膨胀。
- 是否优先遵循删减/简化原则：是。没有复制 Codex Rust 实现，也没有为截图工具写硬编码分支；用一条通用 content item 路径覆盖字符串、对象、MCP image block、data URL、base64、二进制与累计 tool message。
- 代码量/分支/文件数：本次为新增运行时保护能力，非测试代码净增长不可避免；同步偿还了 `runtime.ts` 历史角色命名债务，并把 659 行大 manager 拆回 424 行 manager + 224 行 image service + 81 行纯 utils。
- 抽象与职责划分：`ToolResultContentManager` 负责工具结果预算、脱敏和模型可见内容生成；`ToolResultImageService` 负责图片 content item 识别、摘要与 OpenAI image part 映射；`DefaultNcpAgentRuntime` 保持 agent loop owner；`utils.ts` 只保留 message 拼接入口并委托 manager。
- 目录结构与文件组织：当前 `src` 仍是 package root source surface，直接代码文件数超过目录预算；本次已在 `src/README.md` 记录豁免，后续若继续增长，优先拆 `services/`、`utils/`、`stores/`。
- 独立可维护性复核：通过。no maintainability findings。本次顺手减债：是，已将 `runtime.ts` 收敛为 `agent-runtime.service.ts`，并把过大的 `ToolResultContentManager` 拆成 manager + image service + pure utils。代码增减报告以 guard 口径统计为新增 1288 行、删除 14 行、净增 1274 行；非测试代码新增 1079 行、删除 13 行、净增 1066 行。净增长来自新增跨协议 content item 能力、历史恢复、CLI/session 桥接和真实测试覆盖，属于新增用户可见能力的最小必要增长；剩余风险是本次为保持同步链路暂未实现 Codex 的图片 resize/asset 化策略，后续若图片 payload 本身继续过大，应新增专门 image processing owner，而不是继续向 runtime 主循环追加分支。

## NPM 包发布记录

- 本次是否需要发包：需要在后续统一发布中发包；当前未单独发布。
- 需要发布的包：`@nextclaw/ncp-agent-runtime`。
- 当前发布状态：未发布。
- 未发布原因：本次仅完成本地修复与验证，尚未进入统一 NPM release 流程。
- 后续状态：`@nextclaw/ncp-agent-runtime` 标记为待统一发布；若上层 CLI/desktop release 需要包含该修复，应在统一发布时跟随补发并重新集成验证。
