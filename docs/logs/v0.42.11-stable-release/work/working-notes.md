# 0.42.3 正式版发布工作记录

## 观测口径

- 记录阶段边界、wall time、外部等待、失败重试和人工/自动边界。
- 构建/验证时间以命令输出为准；发布工作流时间以 GitHub Actions 与公开回读时间为准。
- 本文件已按 GitHub Actions 与公网回读补齐总耗时、最慢阶段和下一批可执行提效项。

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
| Desktop 空壳 Release 事故 | 4 个 0 资产公开版本已转回 Draft；原子公开修复验证与 Review 通过 | `.4` Actions 运行 9m35s 后 cancelled；真实 Draft 上传/删除约 10s | 根因是 `release.published` 先公开后构建；Review 两次返工，分别拆分超预算主 CLI、加入唯一 dispatch id 防止同 tag 重试串 run |
| Desktop 重复构建事故 | 删除正式发布前置的平行 `desktop-validate` 门禁 | 单轮 CI 约 8–12m；此前每次正式发布还会再构建一轮 | 正式 workflow 本身已经对将发布的同批五平台产物做安装/启动冒烟；前置 CI 产物不会发布且不能证明生产 bits |
| Draft dispatch 协议 | Draft tag ref 不存在，改为分支 dispatch + 不可变 SHA checkout | preflight 约 43s；Draft 创建后 dispatch 立即返回 HTTP 422 | GitHub Draft `target_commitish` 已写入但 `refs/tags/*` 尚未创建；公开后才允许 tag 成为最终投影 |
| Windows 便携 titlebar 冒烟 | 业务/API/Service App 通过，renderer 证据开关漏设 | 8m26s 时检测失败；Windows job 8m18s | hosted runner 无可见 HWND，便携分支此前没有生成显式 renderer hit-test 证据；临时目录清理又被残留文件锁放大为二次错误 |
| Windows 便携临时清理竞态 | 安装版与便携版 GUI/API/Service App/titlebar 冒烟均通过，测试结束删除临时目录时报 `ENOTEMPTY` | workflow wall 8m53s；Windows x64 job 8m45s；最慢 step 为 Windows build 4m21s | 将临时目录清理延长为有界重试；仅 `EBUSY`/`ENOTEMPTY`/`EPERM` 在重试耗尽后交由 ephemeral runner 收尾，其它错误继续失败 |
| Windows 安装器重复打包锁冲突 | 安装版与便携版冒烟通过后，NSIS 阶段重建同一个 `win-unpacked`，删除 `d3dcompiler_47.dll` 报 Access denied | workflow wall 10m15s；Windows x64 job 10m08s；最慢 step 为 Linux build 5m24s | NSIS 改为 `--prepackaged release/win-unpacked`，直接消费同一批已构建、冒烟和归档的 bits，消除第二次 app packaging 与目录锁冲突 |
| APT Pages 体积门 | APT 专用极限压缩包 105,169,684 bytes，超过 GitHub 100 MiB 上限 312,084 bytes | workflow 在 APT 重打包阶段失败；完整历史 checkout 与 gh-pages fetch 造成额外外部等待 | APT 副本只移除 `better-sqlite3` 的编译期 `src`/`deps`，保留原生二进制与运行库；发布投影 checkout 与 gh-pages 精确 fetch 均改为浅克隆 |
| NPM stable 发布 | 44 个 package 完成 stable 发布，`nextclaw@latest=0.42.3` | 首次正式 workflow 在 package 阶段 22.85s 失败；恢复发布与逐包回读完成 | 初始受 scoped package 认证/权限路径影响；恢复只发布未完成项，没有重复已成功 identity |
| Runtime stable 发布 | `nextclaw@0.42.3` Release、4 个非空资产、stable 更新与旧版本升级验证完成 | workflow/公开回读完成 | 与 NPM 0.42.3 identity 一致，不重复 package publish |
| Desktop stable 发布 | `v0.42.3-desktop.5` 五平台、30 个非空资产、stable manifests 全部完成 | 正式 workflow 到 Release 公开 14m34s；到 APT 首次失败共 21m01s；最慢平台 job Windows x64 12m41s，最慢 step macOS x64 build 6m12s | Draft-first 保证失败对公众不可见；Windows NSIS 改为消费已验证 unpacked bits |
| APT-only 恢复 | `0.0.266` fresh install、upgrade、签名与 gh-pages 推送通过 | 首次恢复 7m55s，最慢为 gh-pages fetch 3m52s；浅 fetch 真实复验降至 5m53s，prepare step 22s | APT 镜像包 103,508,664 bytes；正式 Release `.deb` 保持完整 |
| 公开回读 | NPM/runtime/Desktop/5 个 manifests/APT 全部通过 | Release 30/30 资产；5 个 manifest 均为 runtime 0.42.3；APT 关键 URL HTTP 200 | `.1` 至 `.4` 经 0 资产复核后连同 tag 删除，保留失败 workflow 历史用于复盘 |
| 本地/远程主线对账 | 真实分叉在隔离 worktree 合并验证后普通 push，本地 `master` 安全快进；最终 `0/0` | 最终幂等复验 4.296s，最慢 fetch 3.815s；25 项发布回归 8.49–9.18s | 旧流程把本地 worktree FF 作为远程闭合前置；新 v1 遥测逐阶段记录 wall time，tracked WIP 由无限期单例 worker 自动续跑 |

## 当前提效判断

1. `desktop:package:verify` 的主要时间消耗是重复全仓构建和 seed bundle（本次单次约 69s）；应为未变 package 引入内容寻址构建缓存，并把静态合同快检放在完整 DMG 前。
2. Desktop main 的 CJS 消费 ESM 公共包应建立自动导入图门，阻止 Electron main 新增根入口依赖；这可提前消除原生弹窗式失败。
3. Native 负向门应固化为发布脚本测试，直接断言 `data.ncpAgent.state=error`，避免人工脚本误读顶层 `phase`。
4. 发布器已输出 `nextclaw.desktop-release/v1`，包含 workflow wall time、job 与最慢 step；通用 Delivery 进一步要求所有 release/deploy 采用稳定 schema，并在失败路径保留同一观测链。
5. Desktop 本次最慢平台为 Windows x64 12m41s，最慢单 step 为 macOS x64 build 6m12s；新流程已将外部等待全部放在隐藏 Draft 内。下一步按平台缓存命中率优化，但不得以提前公开 Release 换取表面速度。
6. 所有 release/deploy 统一由 Delivery 要求机器可读时间观测；成功与失败都保留总 wall time、阶段/job、最慢 step、外部等待和重试事实，避免复盘继续依赖会话记忆或人工估算。
7. 发布主线对账不再等待用户选择“空闲时同步”：远程闭合、隔离合并和本地快进分别由同一个协调器拥有；只有活跃 tracked WIP 会让物理快进延后，worker 默认持续到成功并把 PID、目标 SHA、日志和最新报告写入 common Git dir。
