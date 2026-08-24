# 0.42.3 正式版发布工作记录

## 观测口径

- 记录阶段边界、wall time、外部等待、失败重试和人工/自动边界。
- 构建/验证时间以命令输出为准；发布工作流时间以 GitHub Actions 与公开回读时间为准。
- 本文件在发布完成后补齐总耗时、最慢阶段和下一批可执行提效项。

## 已观测流程

| 阶段 | 结果 | 已知耗时/等待 | 重试与发现 |
| --- | --- | --- | --- |
| 现状调查 | 确认压缩修复未进入 0.42.2 Desktop stable | 人工证据链调查 | 修复仅在 0.42.3 beta/NPM，Desktop 未发布 |
| 设计/实现 | 冻结 Node ABI + Electron ABI 双合同 | — | 发现旧 product bundle 参数名无效，`better-sqlite3` 被错误 bundle |
| Runtime 更新验证 | beta 基线到候选自动更新通过 | 初始 build 126.4s；候选 build 115.5s；发现 5.1s | 首次因新发布 Vitest 4.1.11 注册表复制不完整失败 48s，固定 4.1.2 后通过 |
| Desktop 打包验证 | macOS arm64 DMG 与 GUI smoke 通过 | seed bundle 68.9s；DMG 41.6s；smoke 18.4s；GUI ready 11.8s | 冷启动诊断先后发现 Kernel/Core 根入口与 ESM/CJS 边界问题 |
| Native 负向门 | 缺失 SQLite 二进制时 NCP agent 明确 error | 约 27s | 首次验证命令漏设 `ELECTRON_RUN_AS_NODE`，修正编排后得到有效证据 |
| Review | 0 error，no findings | 自动门 4.4s | 首次因超预算验证脚本净增 6 行返工，收敛后净减 2 行 |
| Stable 计划与内容门 | 0.42.2 → 0.42.3 dry-run、双语 Notes/博客与 Docs 构建通过 | dry-run 2.1s；Docs build 6.15s | 首次发现 Changesets 把 beta 版本当公开升级起点；修复为 npm latest 0.42.2，并保留无关 prerelease 漂移硬拦截 |
| 发布自动化 Review | OIDC workflow、33 项发布/治理测试与治理总门通过 | 定向测试 0.24s；TypeScript/测试/治理总门 15.4s | 主发布编排一度跨过 500 行预算；将 Actions 输出与前置条件下沉后恢复为 0 error |
| NPM stable 发布 | 待执行 | — | — |
| Desktop stable 发布 | 待执行 | — | — |
| 公开回读 | 待执行 | — | — |

## 当前提效判断

1. `desktop:package:verify` 的主要时间消耗是重复全仓构建和 seed bundle（本次单次约 69s）；应为未变 package 引入内容寻址构建缓存，并把静态合同快检放在完整 DMG 前。
2. Desktop main 的 CJS 消费 ESM 公共包应建立自动导入图门，阻止 Electron main 新增根入口依赖；这可提前消除原生弹窗式失败。
3. Native 负向门应固化为发布脚本测试，直接断言 `data.ncpAgent.state=error`，避免人工脚本误读顶层 `phase`。
4. 发布阶段继续补齐 Actions 队列、构建、上传、manifest 生效与公开回读耗时，以定位外部等待占比。
