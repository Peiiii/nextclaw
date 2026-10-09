# 压缩后任务连续性修复

## 原始输入与约束

2026-10-09 用户截图指出压缩后重新查找文件、重复流程及重复已执行命令。用户先要求比较 NextClaw、Codex、pi，再要求完成修复、充分验证测试并发布 patch。截图具体算法建议不作为实现要求。

原图本机路径：`/var/folders/gp/ls0ngf8d1qn97_g1t48670zc0000gn/T/codex-clipboard-9ab0acfa-dc3f-4526-b536-225646531678.png`、`/var/folders/gp/ls0ngf8d1qn97_g1t48670zc0000gn/T/codex-clipboard-8e670404-aae8-41f9-8c0d-1f147f825458.png`。图片证明用户现象；缺现场 journal，不将它等同于机制复现。

## 执行与证据

- [活跃合同](../../work/2026-10-09-compaction-continuity/acceptance-contract.md)；[恢复入口](../../work/2026-10-09-compaction-continuity/current-state.md)。
- 修前探针证明命令/调用 ID 被过滤、中间完成事实消失、mid-run 工具尾部为空；既有相关 36 项测试通过，只覆盖预算/格式/恢复。
- 上游对照：Codex `a06545b311fe01e51ce855c7aa5d8da21e9e7aaf`，pi `f1b2e77f5b13b2a199b1052cb79c235451afe7d7`。复用工具身份、近期轮次和增量进度语义，不声称复刻不透明服务端压缩。

## 修复与验证

摘要源保留工具名称、参数、调用 ID 与结果；缩短过长字段但不删除中间消息，身份开销过大时按顺序分批滚动更新摘要。最近完整工具轮次使用最多 20k tokens，且不超过剩余预算的 35%；超大单轮进入摘要，不留下孤立结果。检查点增加可选 retained part end，冻结保留区间，后续新增 parts 只投影一次；旧检查点继续兼容，原 journal 不改写。

新摘要明确 Done/In Progress/Blocked/Failed，继承既有已完成事项。多批任一批失败拒绝安装部分历史；缩小重试预算无法容纳最小输入时，进入明确标注未知执行状态的降级恢复。压缩失败保持上次检查点。

- 自动检查：core 13 项、kernel 88 项、runtime-next 13 项、toolkit 9 项、agent-chat-ui 1 项、server 5 项、相关 UI 39 项，共 168 项通过。新增 9 项针对行为的回归，覆盖短结果身份、中间事实、400 记录分批、冻结尾部、新 parts、连续压缩、失败取消与小窗口恢复。
- `pnpm validate:context-compaction` 中 14 项 `session-conversation-area.test.tsx` 因缺 QueryClient 失败；同基线主工作区运行该文件同样 14 项失败。未改 UI 源码与该测试文件，明确排除已有失败，不声称整套命令全绿。
- core、kernel、runtime-next 的匹配 tsc 通过；core 与 kernel 触达文件 lint 无 error；已有 preflight 测试函数长度 warning 不属于新增。治理与 diff-only maintainability 无 error，两处既有文件预算 warning 经主观审查无需扩大拆分范围。
- 方案审查与实现审查通过。修正发现：小窗口提示长度、重试缩预算后安全降级、内部模块导入边界。净增长用于必要分批与冻结区间保护，不新增 manager、持久化 owner 或公共 SDK 导出。

真实验证经公共 Harness → 同一 AgentKernel 原生运行时 → 配置的真实 provider → 本地 journal。每次使用独立 `/tmp` home，配置与认证只读原配置并在内存覆盖测试预算，未复制凭据；无业务环境副作用。Context window 12k、预留 2.5k，工具 `record_once` 按序执行 alpha/beta/gamma/delta/epsilon/zeta/eta/theta，各结果带约 72k 字符无指令填充。两次自动压缩后完成，并销毁 Harness、重新打开同一持久化会话，要求仅报告完成事项。

| 模型 | 自动压缩 | 操作计数 | 完成 / 冷恢复 |
| --- | --- | --- | --- |
| codex-sub/gpt-6-luna | 2 | 八项均 1，恢复零新增 | CONTINUITY_PASS / RESTORE_PASS，八项全部识别 |
| deepseek/deepseek-flash | 2 | 八项均 1，恢复零新增 | CONTINUITY_PASS / RESTORE_PASS，八项全部识别 |

本机完整源探针、回归、真实 provider 请求/摘要、journal 和结果保存在 `/tmp/nextclaw-compaction-audit-20261009/`。实现前 3 项身份回归失败，修复后通过；真实结果位于 `real-home-multiple/result.json` 与 `real-home-deepseek/result.json`。这证明所测两种模型与长工具任务，不保证任意模型/任务永不遗忘。

## 发布准入

20:18 开始，20:43 真实模型及开发验证完成（Asia/Shanghai）。changeset 指定 core/kernel/nextclaw patch；dry-run 规划产品 `0.59.0 → 0.59.1`，22 个发布包、41 个验证依赖包。README 同步检查与发布健康检查通过，中英文任务说明已更新。检查点字段可选，当前变化无需迁移；常规产品发布排除 Desktop。

EXISTING_RELEASE_PATH：GitHub Actions `release.yml target=product`，认证沿既有 `npm-production` 环境 `NPM_TOKEN`；最近成功生产证据 [run 37608949651](https://github.com/Peiiii/nextclaw/actions/runs/37608949651)。队列审计无正在运行的 release parent，不需要取消 SHA。

### 发布恢复记录

- 用户后续明确要求 Desktop，范围已扩展至 `release.yml target=all`；上文排除 Desktop 仅描述补充授权前的 product 范围。
- NPM `0.59.1` 的 22 个包已发布，发布提交 `d022fb20a`。product parent `37932521522` 在 registry 元数据可见后，单次 tarball 下载仍遇到 404，失败于安装验证；未重复发布包。
- 结构化中英文 notes 已补齐，内容提交 `58def57df`；all parent `37934477862` 恢复同一版本，NPM 安装、Node 兼容矩阵与不支持版本检查通过。Runtime 阶段因 exact-source prepare `37932436055` 未成功而拒绝继续，Desktop 未启动。
- prepare 的 Linux x64、Windows x64、macOS arm64 均在 `pnpm deploy` 下载 `express-5.3.0.tgz` 时遇到 `ERR_PNPM_FETCH_404`；macOS x64 成功。仓库 lockfile 记录 express 5.2.1，不能仅凭错误推断产品代码故障。22:24 按基础设施恢复合同 rerun 原 run 的失败步骤，成功产物保留。
- 自动化缺口已修复原 owner `verify-published-npm-runtime-update.mjs`：archive 下载与 npm install 复用既有有限重试策略。5 项测试覆盖临时 404 恢复、成功即停止、永久错误立即返回与 6 次上限；定向 lint、diff-only maintainability 与新代码治理通过。脚本不进入用户安装包，不新增 changeset、不重新发布 NPM。

- 22:28:36 exact-source prepare rerun 成功；22:29 恢复 all parent 的失败步骤。Runtime promotion 成功，公开 `nextclaw@0.59.1`，没有重新发布 NPM。GitHub Release 正文已从同版本结构化 JSON 补齐中英文内容，保持原身份及四个 Runtime 资产。
- 文档部署曾因新增 note frontmatter title 缺日期前缀失败，提交 `3fc522f1e` 修正。此前 `docs:i18n:check` 未覆盖构建语义；本地完整 `pnpm -C apps/docs build` 16.27s 成功，自动 Docs Deploy `37944244301` 成功，构建生成的统计快照已从任务改动中撤除。
- 22:32 调用主线 reconcile，远程 master 已完整提交；本地 master 有原先 tracked WIP，owner 返回 `LOCAL_WORKTREE_RETRYING` 并启动 worker（PID 23001），不覆盖/提交无关草稿。源区 status 与 binary diff 同初始快照逐字节一致。
- all parent 的 Desktop job 于 22:33:23 自动开始，复用 stable Draft `v0.59.1-desktop.1`、不可变产品提交与内容 checkout；仍待五平台构建、公开渠道和 APT 最终验收。

### 最终交付与复盘

北京时间 22:58:19 [all parent 37934477862](https://github.com/Peiiii/nextclaw/actions/runs/37934477862) overall success，输出 `DESKTOP_READY` / `ALL_PLATFORMS_READY`；NPM/Runtime stable `0.59.1`、内容与完整桌面交付均已闭合。

[Desktop stable v0.59.1-desktop.1](https://github.com/Peiiii/nextclaw/releases/tag/v0.59.1-desktop.1) 非 Draft、非 prerelease，target `d022fb20a82478c63c90366268bd5ad4ba06f9b2`。五平台（macOS arm64/x64、Windows arm64/x64、Linux x64）构建及同一产物冒烟通过；30 个 Desktop 资产公开后，APT 补充资产使最终总数为 31。`gh-pages` 与 public Pages manifest 验证 runtime `0.59.1`，公开 stable APT 验证 launcher `0.0.302`。文档 [run 37944244301](https://github.com/Peiiii/nextclaw/actions/runs/37944244301) 成功。

[Desktop child 37945221674](https://github.com/Peiiii/nextclaw/actions/runs/37945221674) 结构化观察：22:34:51 → 22:57:59，共 23m08s；最慢 job macOS x64 16m37s，其中构建 9m38s，APT job 3m50s。Runtime promotion parent job 22:29:20 → 22:33:19，共 3m59s，超过 120s 目标预算，未声称达标。NPM 首次公布后 metadata/integrity 等待约 6 分钟，随后 tarball 404；prepare 三平台依赖 tarball 404 经 failed-only rerun 恢复。恢复次数与失败不隐藏，未重发 NPM、未制造新产品或 Desktop identity。

复盘处置：修复产品错误归原压缩设计及 9 项回归；archive 缺少自动重试归原安装验证脚本，两项新回归证明恢复边界；文档标题失误就地修正并补完整构建，不新增全局规则。截图现场 journal 未提供，168 项相关检查与两个真实模型测试证明本次范围，不保证任意任务永不遗忘；14 项既有 UI QueryClient 测试失败仍明确保留为基线限制。

功能源码及发布记录均在远程 master，无发布分支遗漏。最终调用主线 reconcile；本地 master 的原有 tracked WIP 被保护，`LOCAL_WORKTREE_RETRYING` 单例 worker 自动续跑，不是用户待办。源区无本任务草稿或无关 WIP 覆盖。CC-01 至 CC-06 全部 passed。
