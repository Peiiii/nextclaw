# SSE 恢复降噪与会话日志内存治理

## 迭代完成说明

本次闭合 Web Chat 周期性 `Network Error` 与 NextClaw 服务内存高水位的同一条放大链路。

- 根因：Nginx 使用默认约 60 秒 upstream read timeout 切断空闲 `/api/ncp/agent/stream`；前端把每次可恢复断流立即写成 `hydrateError`，500 ms 后又重新 loadSeed。与此同时，启动 unfinished-run 恢复通过 `Promise.all` 并发整文件读取全部 session journal，再执行字符串切分和完整事件构造，历史大日志会把 Node 堆和 cgroup 文件缓存同时推高。
- 确认方式：Nginx error/access log 证明断流约每 61–63 秒发生，并在约一秒后触发约 53 KB messages 补拉；两次历史 heap OOM 的 V8 栈都落在 `String::SlowFlatten` / `Runtime_StringSplit`；进程、cgroup 与 `/proc` 采样进一步区分了约 300 MiB 进程树 RSS 和约 480 MiB 文件页缓存。
- 根因修复：线上为 SSE 增加关闭缓冲、1 小时读写超时的精确 Nginx location；源码增加 25 秒 SSE comment heartbeat；已有健康会话只在连续三次快速恢复失败后展示错误；unfinished-run 恢复改成逐 session、逐行扫描，并复用唯一 run lifecycle reducer。
- 该方案直接修复 transport 保活、错误分类和自动读路径的内存边界，没有通过隐藏全部错误、删除历史数据或停止断流补水来掩盖问题。

规范设计见 [SSE 恢复降噪与会话日志内存治理设计](../../designs/2026-08-11-sse-recovery-and-journal-memory.design.md)。

## 测试/验证/验收方式

- hydration/reconnect 定向测试 6/6 通过，覆盖单次断流静默恢复与连续三次快速失败后显式报错。
- SSE route 组装边界测试 3/3 通过，覆盖 25 秒 heartbeat comment frame。
- kernel journal store 定向测试 17/17 通过，覆盖 unfinished-run 生命周期。
- `@nextclaw/ncp-react`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/ui` TypeScript 检查通过。
- 触达文件 targeted ESLint 通过；`git diff --check` 通过。
- 真实公网会话在新的 Nginx worker 上持续约 11 分钟，跨过多个原 60 秒边界；新增 timeout、重连和 messages 补拉均为 0，`NRestarts` 保持为 2。
- VPS 上冻结真实 93,416,916 字节、59,403 行 journal；旧整文件算法和新逐行算法均完整解析 59,403 行，峰值 RSS 从 296,244 KiB 降至 86,672 KiB，下降约 70.7%。

## 发布/部署方式

- 已部署：目标轻量 VPS 的 Nginx SSE 精确 location，先备份配置，`nginx -t` 通过后只执行 reload；没有重启 NextClaw。
- 未部署：SSE heartbeat、前端恢复错误分级和 streaming unfinished-run scanner 仍属于本地源码交付，需后续 NPM/runtime 版本统一发布并安装。
- 源码发布后必须在隔离或维护窗口执行冷启动 journal 恢复验证；热更新不能证明启动对象图和内存峰值。

## 用户/产品视角的验收步骤

1. 从公网入口打开真实会话并保持页面至少两分钟。
2. 确认空闲期间不再每分钟出现 `Network Error`，历史消息和输入仍可正常使用。
3. 发送一条新消息，确认会话能继续流式接收事件。
4. 模拟一次短暂断流，确认会话自动补齐并恢复且不出现失败噪声。
5. 持续阻断连接，确认连续快速失败达到阈值后仍会显示明确错误。
6. 冷启动包含大 journal 的实例，确认 unfinished run 正确恢复、服务没有 OOM，峰值内存符合逐行扫描预期。

## 可维护性总结汇总

- transport heartbeat 仍归 SSE route，用户错误语义归 hydration hook，run lifecycle 归 kernel reducer，没有新增平行业务协议或重复状态 owner。
- unfinished-run scanner 复用现有 lifecycle 判定，只把 IO 从全量并发改成顺序 streaming；没有删除用户数据，也没有引入永久兼容分支。
- diff-only maintainability guard 为 0 error、1 warning。唯一 warning 是 `packages/nextclaw-server/src/app` 已记录的历史目录预算例外，本次没有新增文件、计数变化为 0。
- 因改动跨 transport、React 状态与 kernel journal owner，已执行主观复核；结论为无可维护性发现。必要增长集中在明确 helper、回归测试和跨层设计证据中。
- 新设计文档和迭代目录均通过 planned-path preflight 与文档命名治理。

## NPM 包发布记录

本次需要后续 patch 发布，但当前未执行 NPM 发布：

- `@nextclaw/ncp-react`：registry 当前为 `0.5.20`；恢复错误分级待统一 patch 发布。
- `@nextclaw/kernel`：registry 当前为 `0.6.23`；streaming unfinished-run scanner 待统一 patch 发布。
- `@nextclaw/server`：registry 当前为 `0.15.23`；SSE heartbeat 待统一 patch 发布。
- `@nextclaw/ui`：registry 当前为 `0.15.24`；吸收新的 NCP React 行为并进入 Web UI 产物，待统一 patch 发布。
- `nextclaw`：registry 当前为 `0.30.0`；聚合 server、kernel 与 UI 运行时交付，待统一 patch 发布。

对应 changeset：`.changeset/quiet-sse-recovery.md`。
