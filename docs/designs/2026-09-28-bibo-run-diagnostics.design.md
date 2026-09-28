# Bibo 会话失败诊断与上下文边界

## 用户来源与目标

2026-09-28 用户要求排查会话 `a8ccbe7d-de2f-40ce-96b2-69e03533435f` 最近多次失败；补充要求完整、标准化的服务端日志，后续不依赖浏览器；随后明确指出不应把输入限制过死，应复用 NextClaw 上下文压缩。

目标：定位现有失败，修正托管层与内核上下文预算冲突，让维护者凭会话或请求编号查出执行、模型、压缩、保存和失败阶段。用户随后明确要求上线，发布范围限定为 Bibo 托管服务。

## 已确认依据

- 线上容器 2026-09-28 07:09:21.126Z、07:10:01.062Z 连续记录模型 HTTP 413（模型输入过长）；Worker 同期只保留泛化提示。对应账号快照含目标会话，最后更新时间 07:08:42.913Z。历史日志缺 session/run 关联，时间与账号证据不能伪装为逐请求精确关联。
- Bibo model gateway 对包含历史、工具的完整 JSON 设置 128 KiB 门槛。
- Runner → NextclawHarness.runTask → session.run → Native runtime → runNativePreflight → ContextCompactionManager。配置默认 contextTokens=200000，reserved=10000，压缩触发 190000；Bibo 没有覆盖它，128 KiB 与 token 预算不是同一合同。
- 目标 journal 有早期 runtime interrupted 记录；这些不是最近 HTTP 413 的同义事件，日志应分别保留。
- Cloudflare Workers 与 containers 已有集中日志 API；不新增数据库、日志平台或驻留查询服务。

## 使用链路与选择

维护者收到会话链接 → `pnpm -C apps/bibo-hosted logs -- --session <id> --since 24h` → 使用 Cloudflare 管理凭据查询 Worker 和容器历史 → 按统一 runId 查看 accepted、模型状态、压缩状态、保存结果及耗时 → 需要时缩窄 `--run` 或时间范围。命令同时支持 JSON 输出；无匹配要明确返回空而不是判断没有错误。旧日志不能补造关联，可用时间查询并显示证据局限。

用户继续长会话 → Harness 仍按内核预算自动压缩 → 网关允许正常长上下文请求 → 若发生模型、压缩、保存错误，保留结构化错误码和 request/run 编号，用户得到安全且有区别的说明。

选择现有 Cloudflare 集中日志 + 小型只读查询命令；只加 console 文本无法关联，另建持久日志库会重复平台能力。日志不承载业务状态，DO 仍拥有保存提交结论。

## 合同

- 删除 128 KiB 限制，保留 16 MiB 的流式读取传输保护，只防止异常巨大请求占满 Worker 内存，不作为 token 预算；正常上下文压缩完全复用 kernel。不在 Bibo 复制压缩器，不通过降低 contextTokens 迎合旧限制。
- 统一结构化记录：schema、event、level、timestamp、runId、sessionId、component、stage、status、errorCode、durationMs、字节数/条目数等白名单标量。Worker 生成 runId，经 DO、runner、provider extraHeaders 传至 model gateway；外部传入 ID 仅作诊断，不能作身份或授权。
- 记录请求接入/拒绝、run 开始/终止、模型请求/响应、压缩状态、snapshot/commit/rollback、取消/断连。流式 HTTP 200 不代表业务成功，最终 run 结果单独记录。
- 不写 token、cookie、模型输入输出、工具参数/结果、完整 raw error。已知错误转换为稳定码与安全文案；未知错误只记录安全类别和服务端代码位置，不记录可能含用户正文的异常 message。
- Worker 日志采样改为完整记录；容器结构化日志显式 level。保持每阶段一条，不记录 token delta；记录成本增加来自必要阶段日志，不增加付费后端资源。
- 未保存失败仍执行已有 stop/restore 路径，不破坏已有快照与隔离。脱敏在 producer 完成，查询命令不以输出原始请求头作为诊断功能。

## 验收账本

contract-id: bibo-run-diagnostics-20260928；flow: bugfix；risk: L3；plan: not-required（单批）；design-review: passed（核查来源、旧日志不可逆缺口、长请求与敏感内容、保存失败边界，未关闭 finding 为零）。

| ID | Required | 标准 | Status | 证据 |
| --- | --- | --- | --- | --- |
| BD-1 | true | 线上错误、目标会话与压缩链路有直接证据，局限明确 | passed | 上述 API 日志、R2 快照与源码 |
| BD-2 | true | 正常超过 128 KiB 请求可通过；异常巨大请求有界拒绝；内核压缩沿用 | passed | 网关真实函数组装测试覆盖 150000 字节请求；流式读取测试；内核压缩 23 项测试 |
| BD-3 | true | Worker/DO/runner/model 可按 run/session 关联，业务终态与保存结果明确 | passed | 新容器 100% 滚动后，线上 run `6fb7b4d1-5f42-4b61-89fb-2156700e1394` 在 Worker、Container、模型网关与快照提交中使用同一 run/session ID |
| BD-4 | true | 日志不含凭据与聊天正文；已知错误不再降为无原因重试 | passed | runner/Worker SSE 错误码、白名单和脱敏测试 |
| BD-5 | true | 无浏览器的历史查询命令可运行，有时间/会话/run/JSON 与空结果说明 | blocked | CLI 现能对 Cloudflare 采样查询返回现有事件并标记 `complete: false`，但本机 Wrangler OAuth 对 telemetry/query 返回 403；连接的 Cloudflare API 工具已完成无浏览器线上查询，CLI 仍需具备相应权限的 API token |
| BD-6 | true | 定向故障回归、三套 tsc、构建、适用浏览器回归与 Review 完成 | passed | 26 项诊断测试、三套 tsc、Vite/runner build、桌面/手机 mock API 浏览器回归、targeted lint、governance、maintainability 0 error；适用范围见下文 |

## 当前状态

实现已从冻结远程主干 `37f9e3667` 部署到 Bibo；Worker 版本 `afff6f75-bfe3-4f2e-a2f8-7270b2eb6a3f`，容器版本 23、镜像 `sha256:4ef68e222cc8ea7f8bdd9681aa1ca78890cda123eda9e8b522ff24b388fe364c`，均已 100% 生效。150117 字节真实模型请求返回 200；100% 滚动后专用账号真实模型、搜索、保存、刷新和桌面/手机文件预览冒烟通过。第一轮冒烟开始于容器仅 20% 滚动时，不用它判断新镜像日志。主工作区原有 thoughts 改动不属于本任务。只读下载的事故快照位于 `/tmp/bibo-diagnostic-snapshot.tgz`（0600），不得提交或公开其正文。

实现复用原 HTTP 路由，移至 `src/app/routes/bibo-http.route.ts`，DO 继续拥有运行与提交。诊断纯函数位于 `src/app/diagnostics`，只读查询脚本位于 `scripts/diagnostics`，没有新增状态 owner。主体文件由 401 行降至 367 行；维护性检查剩余两条警告为既有 app 目录数量和文件接近预算，未扩大目录债务。人工 Review 核查输入边界、HTTP 200 内业务失败、rollback、临时配置的诊断头与敏感数据白名单，无未关闭代码 finding。

本地证据：`/tmp/bibo-diagnostics-targeted-final.log`、`/tmp/bibo-compaction-tests.log`、`/tmp/bibo-diagnostics-tsc-final.log`、`/tmp/bibo-diagnostics-client.log`、`/tmp/bibo-diagnostics-browser.log`、`/tmp/bibo-diagnostics-governance.log`、`/tmp/bibo-diagnostics-review.log`；查询工具采样修正后 26 项诊断测试及三范围 tsc 再次通过。全套 app 测试曾遇到 `bibo-space.store.test.ts` 加载 `.css` 的环境/既有依赖问题；该未修改链路未被计入通过范围。

复盘沉淀归原 app README 与本设计：历史查询必须覆盖 Worker 和 Container 两个数据源；业务终态不能由 SSE 的 HTTP 200 推断；托管传输限制不能代替内核 token 预算；容器滚动中的冒烟不能作为新镜像证据；Cloudflare 采样标记不能让 CLI 丢弃可查询事件。新增回归保护这些失效边界，不增加常驻 AI 规则或通用治理脚本。仍未关闭：BD-5 的 CLI 本机认证权限，线上连接的 Cloudflare API 工具可无浏览器查询。
