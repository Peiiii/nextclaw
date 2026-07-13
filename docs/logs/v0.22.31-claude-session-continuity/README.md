# v0.22.31 Claude 会话上下文连续性

## 迭代完成说明

本次修复 Claude Code runtime 在同一个 NextClaw 会话中无法承接上一轮上下文的问题，并验证会话绑定可以跨 NextClaw 服务重启恢复。

根因包含两个连续的违约点：

- Claude NARP wrapper 没有把通用 wrapper 已提供的 `setSessionMetadata` 回写端口交给 Claude SDK runtime。SDK 虽然从首轮事件中取得了 `session_id`，但 `claude_session_id` 无法写回 NCP session metadata，下一轮只能创建新的 Claude 会话。
- 补齐回写后，项目使用的官方 Claude Agent SDK `0.2.63` 在恢复已持久化会话时连续返回 403；同一个 Claude session 使用系统 Claude Code `2.1.139` 可以正常恢复并回答上一轮暗号。升级到官方 Agent SDK `0.3.207` 后，resume 路径可以正常承接上下文。

修复落在既有 owner：Claude NARP wrapper 负责传递 metadata 回写端口，Claude SDK runtime 负责持久化它从 SDK 事件中获得的 Claude session id。没有在通用 stdio client、kernel 或 service 中增加 Claude 特判。

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

## 发布/部署方式

本次变更需要随下一次 NPM 正式版统一发布，因为修复涉及两个已发布 Claude runtime 包，并升级了官方 Claude Agent SDK 依赖。

数据库 migration、桌面 installer、桌面 update manifest 与 GitHub desktop release 不适用。

## 用户/产品视角的验收步骤

升级后新建 Claude Code 会话，或在尚未建立 Claude runtime 绑定的会话中继续发送消息：

1. 第一轮告诉 Claude 一个临时暗号。
2. 第二轮只询问上一轮暗号，应能准确回答。
3. 重启 NextClaw 后再次询问，仍应准确回答。

修复前已经产生的多轮 Claude 会话没有保存统一的 `claude_session_id`，无法自动重建已经丢失的旧 Claude 上下文；升级后的新消息会开始建立并持久化正确绑定。

使用 `pnpm dev start` 验证时，Claude extension 仍从 `dist` 启动；修改 extension `src` 后要先运行 `pnpm dev:extensions:build` 并重启对应进程。Runtime-default 还依赖用户自己的 Claude 配置和 `ANTHROPIC_BASE_URL`，应选用 Claude Messages/工具协议兼容的上游；也可以显式选择已经通过验证的 NextClaw provider 模型。

## 可维护性总结汇总

本次复用了现有 NARP `session_info_update` 与 NCP metadata patch 主链路，没有新增协议字段、fallback、service、adapter 或 provider 特判。Claude runtime 内删除了构造 metadata 后再重复写同一字段的双写表达，改为更新唯一内存 owner 后回写快照。

- 代码与测试新增 19 行、删除 20 行、净减少 1 行；排除测试后新增 16 行、删除 20 行、净减少 4 行。
- 测试仅补充 metadata 回写端口的合同断言。
- 文件数、目录层级、运行时分支与 owner 数量均未增加。
- 官方 SDK peer 依赖只落在 Claude runtime package 内，没有扩大修改其它 MCP package。
- `src/index.ts` 从 388 行降到 383 行，仍接近 400 行预算线但没有继续恶化；后续出现新的独立变化原因时再按 owner 拆分。
- `post-edit-maintainability-guard` 无错误，`post-edit-maintainability-review` 结论为通过。

## NPM 包发布记录

待随下一次 NPM 正式版统一发布：

- `@nextclaw/nextclaw-narp-runtime-claude-code-sdk`
- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
