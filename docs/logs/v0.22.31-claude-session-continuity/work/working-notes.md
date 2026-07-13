# Claude runtime failure 与源码调试工作记录

## 目标

- 查清目标会话的 API Error 来源，区分外部上游故障与 NextClaw 自身合同缺口。
- 修复后按同一真实链路复现，确认错误在用户侧保持可见，同时协议不再把失败请求按成功收尾。
- 提供独立的一键 Claude 源码调试命令，不增加默认 `pnpm dev start` 的启动和监听成本。

## 修前证据

- NCP journal 中同一会话交替出现成功回复与 `API returned an empty or malformed response (HTTP 200)`，并出现过 `concurrent prompt not supported`。
- shell 的 `ANTHROPIC_BASE_URL` 指向 `https://chat.nuoda.vip/claudecode`；Runtime-default 会继承该 Claude 配置。
- Claude 原始 JSONL 把空响应记录为 synthetic assistant API error；进入项目 SDK 对象后保留 `message.model=<synthetic>`、`error` 和 API Error 文本。
- `extractFailureMessage` 不识别该形状，NARP wrapper 也不处理 NCP `message.failed` / `run.error`。
- 用户当前会话 `ncp-mrjaujne-e80d2f11` 的 Claude 原始 JSONL 记录了 Cloudflare 522，正文明确为 `national.venlacy.com` 源站 TCP 建连超时；同一地址稍后直接请求虽然返回 200，结构却是 `choices: null`，没有 Anthropic Messages `content`。
- 同一源码 dev 进程下，显式 `minimax/MiniMax-M2.7` 正常返回，排除了 Claude runtime 和 `pnpm dev:claude` 源码链路整体失效。
- 在原 NextClaw session 切到 MiniMax 时，修前报 `No conversation found with session ID`：旧 Runtime-default Claude ID 被错误交给了显式 provider 的隔离配置目录。

## 修前自动化复现

- synthetic assistant error 测试期望提取 API Error，实际得到 `null`。
- NARP wrapper 测试期望 ACP prompt 因 `run.error` reject，实际结束为 `end_turn`。

## 修复

- 通过 SDK 实际可观察字段识别 synthetic API error。
- 仅对空/畸形响应、仅在没有任何可见输出时最多尝试三次，避免部分输出后重复执行工具或内容。
- 尝试耗尽后发出 NCP failure，并由通用 NARP wrapper 转成 ACP prompt failure。
- 新增 `pnpm dev:claude`，只在该入口下覆盖 Claude NARP command 到 TypeScript controller，并把三个相关源码目录加入 backend reload watch。
- 保持默认 `pnpm dev start` 的 package watch disabled、Claude source override disabled。
- 同一个 NextClaw session 始终复用同一个 `claude_session_id`，model/provider 只作为当前轮执行路由。
- 接入 Claude Agent SDK 官方 `SessionStore`，把 transcript 持久化到 NextClaw data home；恢复时可跨 Runtime-default 与显式 provider 的配置目录 materialize 同一会话。
- 对已有 `claude_session_id`，若 store 尚无数据，则从用户 Claude 配置目录和 NextClaw 隔离配置目录中查找最新 JSONL 并一次性迁移。

## 修后真实复现

- Runtime-default 的第三方上游仍连续返回空/畸形 HTTP 200；现在经历三次尝试后产生 `message.failed` / `run.error`，不会产生错误的 `message.completed/run.finished`，UI 通过 session failure card 展示错误。
- 显式 `minimax/MiniMax-M2.7` 成功输出暗号；触发 Claude 源码重载后，同一 session 仍能回答该暗号。
- 默认 dev backend 参数无 Claude `--include`；专用 dev backend 含三个 Claude/NARP source include，源码触碰后 backend PID 变化。
- 同一真实 session 先用 MiniMax M2.7 写入 `NC-MAP-8317`，切到 M3 后准确回忆；Claude session ID 始终为 `74f917f0-ea36-48dd-8c25-235660819c84`。
- 切到另一配置目录的 Runtime-default 后已越过本地 resume，失败点变为独立上游 403；没有再出现 `No conversation found`，Claude session ID 未变化。切回 M3 后仍能回忆 marker。
- `pnpm dev:claude` backend 重载后，同一 session 再次准确回忆 marker，确认 store 可跨进程恢复。

## 边界

- 第三方 `ANTHROPIC_BASE_URL` 的协议兼容性和稳定性不由本仓库控制；本次不声称修复外部网关。
- 不做静默模型 fallback，避免用户选择 Runtime-default 时实际落到另一个 provider。
- 官方 Claude Agent SDK 已在上一修复升级到 `0.3.207`；本次故障不是继续升级 SDK 即可解决的问题。

## 收口结果

- 三个相关 package 的 lint、tsc、tests 与 build 均通过，合计 13 个测试通过。
- scoped maintainability guard 为 0 error、2 个接近文件预算的 warning，governance backlog ratchet 通过。
- 全工作区 `lint:new-code:governance` 剩余 3 个 module-structure error，全部位于并行 chat UI/settings 改动；本次 Claude 根目录测试违规已通过删除假测试入口消除。
- 最终 scoped guard：源码、脚本与测试新增 747 行、删除 115 行；非测试新增 526 行、删除 114 行。默认新增能力口径 0 error、2 warning；纯 bugfix 补充口径命中非测试净增 gate，必要增长理由已记录到迭代 README。
- `src/index.ts` 一度从 383 行增长到 402 行并触发文件预算阻塞；将 retry policy 收敛到 query runtime utils 后降到 398 行，阻塞消失。剩余两个 warning 是 runtime 主文件和既有 event mapper 接近 400 行预算。
- 全工作区 governance 的 4 个 module-structure error 来自并行 chat UI/settings 文件；本次 Claude/NARP scoped governance 另行验证，未修改这些并行文件。ratchet 与 generated-clean 均通过。
- 最终版本再次启动默认与专用 dev：默认无 Claude include；专用入口包含三个源码 include，源码变化触发 backend 从 PID 18842 重启为 20837。
- skill RED/GREEN 验证：旧 skill 只能引导执行者选择 `pnpm dev:extensions:watch`，并判断无法完成一键 Claude 调试；更新后同一场景准确选择 `pnpm dev:claude`，同时给出默认 dev 隔离边界与启动日志验收信号。
