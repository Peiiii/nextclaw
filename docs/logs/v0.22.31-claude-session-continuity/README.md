# v0.22.31 Claude 会话上下文连续性

## 迭代完成说明

本次修复 Claude Code runtime 在同一个 NextClaw 会话中无法承接上一轮上下文的问题，并验证会话绑定可以跨 NextClaw 服务重启恢复。

同批次继续修复了 Claude runtime 的失败传播和本地源码调试链路：Claude Code 生成的 synthetic API error 不再让协议错误地成功结束；空响应类瞬时错误会在尚未产生可见输出时最多尝试三次，耗尽后由 NARP/ACP 正确返回运行失败，UI 仍会在对话底部展示具体错误。新增独立的 `pnpm dev:claude`，直接运行 Claude runtime TypeScript 源码并随源码变化重启 dev backend；默认 `pnpm dev start` 不启用这条源码监听链路。

后续真实对照又暴露出会话绑定的路由边界：Runtime-default 使用用户 Claude 配置目录，而显式 NextClaw provider 使用隔离配置目录；旧实现只持久化 `claude_session_id`，切换路由后仍把旧 ID 交给新目录，导致 `No conversation found with session ID`。一次中间修复错误地把完整模型路由变成会话复用作用域，虽然避开了跨目录 resume 错误，却会在用户切模型时创建另一段 Claude 对话，同样违背产品连续性。

最终实现把产品会话身份与执行路由解耦：同一个 NextClaw 会话始终复用同一个 `claude_session_id`；Claude Agent SDK 官方 `SessionStore` 将 transcript 持久化到 NextClaw data home，并在 Runtime-default、显式 provider 或不同 `CLAUDE_CONFIG_DIR` 之间恢复同一 transcript。provider 配置仍保持隔离，模型和 provider 只影响当前轮执行，不再改变对话身份。

根因包含两个连续的违约点：

- Claude NARP wrapper 没有把通用 wrapper 已提供的 `setSessionMetadata` 回写端口交给 Claude SDK runtime。SDK 虽然从首轮事件中取得了 `session_id`，但 `claude_session_id` 无法写回 NCP session metadata，下一轮只能创建新的 Claude 会话。
- 补齐回写后，项目使用的官方 Claude Agent SDK `0.2.63` 在恢复已持久化会话时连续返回 403；同一个 Claude session 使用系统 Claude Code `2.1.139` 可以正常恢复并回答上一轮暗号。升级到官方 Agent SDK `0.3.207` 后，resume 路径可以正常承接上下文。
- 初版跨路由修复混淆了“provider 配置隔离”和“产品会话身份”，用 `claude_session_model` 决定是否复用 ID。模型是可变执行参数，不是会话 owner；正确边界是保留配置隔离，同时用 SDK `SessionStore` 外置稳定 transcript。
- 此前 `ANTHROPIC_BASE_URL=https://chat.nuoda.vip/claudecode` 间歇返回 HTTP 200 空/畸形响应。SDK 将该响应包装成 `type=assistant`、`model=<synthetic>` 的 API error，但 runtime 旧逻辑只识别 result/error 失败，因而把这次请求按普通 assistant 消息成功收尾；通用 NARP wrapper 又没有把 NCP `message.failed` / `run.error` 转成 ACP prompt 失败。
- 用户当前 Runtime-default 指向 `https://national.venlacy.com`：目标请求真实返回过 Cloudflare 522，明确标记源站 TCP 建连超时；随后直接请求恢复为 HTTP 200，但响应是 `choices: null` 的 OpenAI 风格结构而非 Anthropic Messages `content`。这证明 522 与畸形 200 都来自同一外部网关，不是仓库依赖升级能够修复的问题。

修复落在既有 owner：Claude NARP wrapper 负责传递 metadata 回写端口并始终复用已绑定的 session id；Claude SDK runtime 负责持久化 transcript、迁移旧本地 JSONL、识别 SDK synthetic failure，并仅在未产生可见输出时重试；通用 NARP stdio wrapper 负责把 NCP 失败合同映射成 ACP prompt 失败。没有在 kernel、service 或 UI 中增加 Claude 特判，也没有为失败网关增加静默模型 fallback。

详细排查与复现证据见 [work/working-notes.md](work/working-notes.md)。

## 测试/验证/验收方式

修前真实复现：

- 在 55667 上使用同一个 NCP session，第一轮要求记住 `NCCTX-7319`，第二轮只询问上一轮暗号。
- 第一轮返回“已记住”，第二轮返回“没有上一条消息，也没有暗号”。
- 对应 NCP metadata 没有 `claude_session_id`，确认上下文未绑定到 Claude 会话。

修后真实验证：

- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk tsc`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk test`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk test`
- `pnpm --filter @nextclaw/nextclaw-ncp-runtime-claude-code-sdk lint`
- `pnpm --filter @nextclaw/nextclaw-narp-runtime-claude-code-sdk lint`
- 两个 Claude runtime package 的 build 均通过。
- 在 55667 上使用同一个 NCP session：第一轮写入 `NCCTX-9654` 后，metadata 持久化 `claude_session_id`；第二轮准确返回 `NCCTX-9654`。
- 完整重启 55667 NextClaw 产品服务后，再次使用同一 NCP session 追问，仍准确返回 `NCCTX-9654`。
- 在 `pnpm dev start` 的 18792 dev 后端上，以 `Claude Code NARP + minimax/MiniMax-M2.7` 使用同一个 NCP session：第一轮写入 `DEVCTX-7482`，第二轮准确返回 `DEVCTX-7482`，metadata 持久化同一个 `claude_session_id`。
- 最终验证期间，自定义 Grok Runtime-default 上游出现过一次间歇性 403；`claude_session_id` 未变化，随后通过同一 NCP session 再次追问仍返回 `NCCTX-9654`。该现象属于独立的上游鉴权稳定性信号，不是上下文重新建会话。
- 提交前再次验证时，该自定义 Grok Runtime-default 上游对系统 Claude Code `2.1.139` 和项目 SDK 内置 Claude Code `2.1.207` 均稳定返回 `422 tools[0].type must be function`；禁用 Claude 工具后又返回 HTTP 200 畸形响应。对照的 NextClaw MiniMax provider 正常，确认这是当前 `ANTHROPIC_BASE_URL` 网关的 Claude Messages/工具协议兼容问题，不是 SDK 升级回归或 session 绑定失败。
- 用户给出的原始 55667 会话 URL 已做只读页面加载检查，没有向原会话写入额外测试消息。
- 修前回归测试可稳定复现两个合同缺口：Claude synthetic assistant error 无法提取失败文本；NARP wrapper 收到 `run.error` 后仍把 ACP prompt 结束为 `end_turn`。修后两个测试均通过。
- 使用隔离 `NEXTCLAW_HOME` 启动默认 `pnpm dev start`：日志显示 package dist watch disabled，backend 参数没有 Claude `--include`，确认默认启动成本未增加。
- 使用隔离 `NEXTCLAW_HOME` 启动 `pnpm dev:claude`：日志显示 `Claude runtime source: enabled`；Claude controller 进程实际指向 `src/controllers/claude-code-narp.controller.ts`；触碰 Claude runtime 源码后 backend PID 变化并重新启动。
- 真实上游失败验收：Runtime-default 连续三次收到空/畸形 HTTP 200 后产生 `message.failed` / `run.error`，没有错误的 `message.completed/run.finished`；对话 UI 通过既有 session failure card 保留错误可见性。
- 真实成功对照：显式选择 `minimax/MiniMax-M2.7`，首轮准确输出 `CLAUDE_MINIMAX_OK`；触发源码重载后，在同一 NextClaw session 再次询问，仍准确返回该暗号，证明源码热重载和 session continuity 同时成立。
- 三个相关 package 的 lint、tsc、build 与测试均通过：Claude NCP runtime 8 tests、通用 NARP stdio wrapper 3 tests、Claude NARP launcher 7 tests。
- 修前自动化用例稳定复现：metadata 已有 `claude_session_id`，但 preferred model 改变后 wrapper 把 `sessionRuntimeId` 置为 `null`；正确合同测试要求继续传递原 ID，修前 2 个用例失败，修后均通过。
- 真实跨模型复验：同一 NextClaw session 先用 `minimax/MiniMax-M2.7` 写入 `NC-MAP-8317`，再切到 `minimax/MiniMax-M3` 追问，准确只回 `NC-MAP-8317`；两轮底层 Claude session ID 均为 `74f917f0-ea36-48dd-8c25-235660819c84`。
- 跨配置目录复验：同一 session 切到 Runtime-default 后不再出现 `No conversation found`，而是加载原会话并走到上游后返回当前账号独立的 403；Claude session ID 未变化。切回 M3 后仍准确返回 `NC-MAP-8317`。
- 源码重载复验：`pnpm dev:claude` backend 从 PID 86128 重载为 22482；重启后同一 NextClaw session 再次准确返回 `NC-MAP-8317`，证明 transcript store 和 metadata 绑定均可跨进程恢复。
- 持久化 store 定向测试覆盖：跨 store 实例加载、UUID 幂等去重、无 UUID 条目保序追加、旧 Claude JSONL 自动迁移；query options 测试确认 `sessionStore` 与原 `resume` ID 同时传入官方 SDK。

## 发布/部署方式

本次变更需要随下一次 NPM 正式版统一发布，因为修复涉及两个已发布 Claude runtime 包，并升级了官方 Claude Agent SDK 依赖。

数据库 migration、桌面 installer、桌面 update manifest 与 GitHub desktop release 不适用。

## 用户/产品视角的验收步骤

升级后新建 Claude Code 会话，或在尚未建立 Claude runtime 绑定的会话中继续发送消息：

1. 第一轮告诉 Claude 一个临时暗号。
2. 在同一个 NextClaw 会话中切换模型，再询问上一轮暗号，应能准确回答。
3. 重启 NextClaw 后再次询问，仍应准确回答；持久化的 `claude_session_id` 应始终不变。

修复前已经产生的多轮 Claude 会话没有保存统一的 `claude_session_id`，无法自动重建已经丢失的旧 Claude 上下文；升级后的新消息会开始建立并持久化正确绑定。

已经保存 `claude_session_id` 的旧会话会继续复用该绑定；第一次恢复时，runtime 会从用户 Claude 配置目录或 NextClaw 隔离配置目录查找对应 JSONL，并导入持久化 transcript store。旧的 `claude_session_model` 即使存在也不再参与身份判断。

普通开发仍使用 `pnpm dev start`，它不会额外监听或构建 Claude runtime。调试 Claude runtime 源码时使用 `pnpm dev:claude`，无需手动 build；启动日志应包含 `Claude runtime source: enabled`。Runtime-default 仍依赖用户自己的 Claude 配置和 `ANTHROPIC_BASE_URL`，应选用 Claude Messages/工具协议兼容的上游；也可以显式选择已经通过验证的 NextClaw provider 模型。

## 可维护性总结汇总

本次复用了现有 NARP `session_info_update` 与 NCP metadata patch 主链路，没有新增协议字段、fallback、kernel/service 特判。新增的 `ClaudeCodeSessionStore` 是 transcript 持久化唯一 owner，直接实现官方 SDK 合同；wrapper 删除模型作用域门槛，模型路由与会话身份恢复为两条独立职责。

同批失败修复继续沿用唯一 owner：SDK runtime 判定/重试 SDK failure，通用 NARP wrapper 传播 NCP failure。专用开发命令复用既有 dev runner，只把命令覆盖与 watch path 纯逻辑拆到 `scripts/dev/utils`，默认启动路径没有新增构建或 watch 分支。

- 官方 SDK 依赖只落在 Claude runtime package 内，没有把 provider/runtime 细节扩大到 kernel、service 或其它 MCP package。
- 最终 scoped guard 统计源码、脚本与测试新增 747 行、删除 115 行、净增 632 行；排除测试后新增 526 行、删除 114 行、净增 412 行。本批同时交付独立 `pnpm dev:claude` 开发能力、失败重试/传播合同和持久化跨模型会话能力，因此按新增能力口径通过；以纯 bugfix 口径运行的补充报告会命中净增长 gate。
- 净增长合理性记录：官方 SDK 只提供内存 store，没有可跨进程复用的文件持久化实现；复用用户 `CLAUDE_CONFIG_DIR` 又会破坏 NextClaw provider 隔离。新增 237 行 `ClaudeCodeSessionStore` 是唯一 transcript owner，覆盖安全文件名、0600/0700 权限、同进程写入串行化、UUID 幂等和旧 JSONL 迁移；继续压缩会删除持久化或迁移合同，而不是减少重复复杂度。
- 已完成的删减与职责收敛：删除错误的模型作用域门槛和 `claude_session_model` 写入；retry 判定从 runtime 主流程收敛到既有 query runtime utils，使 `src/index.ts` 从 402 行回落到 398 行。scoped guard 为 0 error、2 warnings；warning 是 `src/index.ts` 398 行和既有 event mapper 349 行接近 400 行预算。
- `post-edit-maintainability-review` 结论：无阻塞 finding。模型不再参与会话身份、provider 配置隔离仍然保留、旧 transcript 迁移只有一条路径，没有静默 fallback 或平行 session owner；后续 watchpoint 是 runtime 主文件若再出现新的独立变化原因，应拆出 query/run 协调 owner，而不是继续贴近预算增长。

## NPM 包发布记录

待随下一次 NPM 正式版统一发布：

- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
- `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`
