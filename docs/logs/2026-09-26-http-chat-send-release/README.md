# HTTP 聊天发送修复与 v0.57.2 稳定发布

## 迭代完成说明

状态：修复、版本说明和发布检查器修复已合入远程 master；`NPM_READY`、`NEXTCLAW_STABLE_READY` 与 `CONTENT_READY` 已闭合。用户明确授权合入主干并发布新版本。产品范围为 NPM 与 Runtime，未要求桌面安装包。

根因：`260eae4fb` 为发送确认添加消息 ID 时直接调用了仅在安全上下文可用的 `crypto.randomUUID()`；普通 HTTP 浏览器在请求发出前抛错。`988f2bfb0` 曾修复编辑消息的同类错误，但其测试不覆盖这次共用发送控制器。新回归测试在修前对普通发送、steering 和菜单预设消息均复现同一 TypeError。修复使用 HTTP 可用的 `getRandomValues` 生成 128 位随机消息身份，直接修正 producer，并继续复用原 envelope 的幂等键与重试身份。

设计与详细证据见[发送草稿设计中的 HTTP 回归修复](../../designs/2026-09-24-移动端发送草稿回填.design.md)。修复提交 `75e5ddea38be58713fae8adefffc1126bf1a597e`；说明提交 `c3472a1121e8fc29b2579fc4996dd0bd36b81ea8`。

## 测试/验证/验收方式

- 25 项 controller 与历史编辑发送测试通过；验证 HTTP 缺少 randomUUID、同毫秒消息身份不同、接收确认与幂等键一致，并复用已有重试测试。
- 原草稿工作区 UI tsc 通过；迁移后的触达 UI、SDK、Server、Core 源码与该检查基线一致。隔离工作区首次 tsc 因未生成依赖声明失败，随后 exact-SHA prepare 的完整发布依赖闭包构建与严格验证成功；不以缺失产物当作源码回归，也不为纯前端改动在本地重建 Portable Runtime。
- 真实 Chromium 非安全 HTTP 环境验证 randomUUID 缺失、getRandomValues 可用及随机 ID 正常生成。
- 当前源码 UI 的真实会话 `ncp-muiebv32-uesfoiv9` 经既有本地后端接收测试消息、持久化 `user-ebbd50eacda64d5e846e38233541e5b8`，并显示 DeepSeek 回复“发送正常”。回环地址属于安全上下文；非安全上下文发送由 controller 边界回放证明，未冒充用户现场复验。
- 文档站构建、结构化说明与双语 GitHub Release 正文校验、治理检查与 backlog ratchet 通过。
- 初始 parent 完成 16 个 macOS/Linux/Windows × Node 20/22/24/26 安装与 SQLite cell，恢复 parent 复用本版成功证据，不重复全矩阵安装；unsupported Node guard 通过。
- 恢复 parent 在 `13:39:46Z–13:41:08Z` 成功执行真实 `0.57.1 → 0.57.2` 的发布态检查、下载、应用和新进程升级验证。

## 发布/部署方式

`EXISTING_RELEASE_PATH`：`release.yml`，已验收的 `npm-production` environment token 路径；最近成功生产 run `36009870452`。使用隔离 worktree 精确迁移本次六个文件，核对全部内容后只撤掉主工作区对应增量，原想法文档 WIP 保持不变。

一次 dispatch `release.yml target=product expected_head=75e5ddea38be58713fae8adefffc1126bf1a597e`；parent [36244143428](https://github.com/Peiiii/nextclaw/actions/runs/36244143428)，创建于 `2026-09-26T13:08:05Z`。exact-SHA prepare run `36244131981` 创建于 `13:07:51Z`。发布 workflow 独立拥有 registry、四平台 Runtime promotion、旧版本真实升级与终态。说明合入后由既有 Docs Deploy 发布，不重复 dispatch 核心版本。

初次 mainline reconciliation 返回 `LOCAL_WORKTREE_RETRYING`，原主工作区存在 tracked 想法草稿；自动 worker 已接管，禁止覆盖草稿或 rebase/stash/reset。

收尾由原主工作区的同一 reconciliation owner 接管，复用既有 worker `48757`，避免删除任务 worktree 后重试脚本失去运行目录。仅停止本任务 worktree 的 worker `96749` 与测试用 Vite 预览，保留既有后端宿主和主工作区 WIP；任务记录推送后清理该隔离 worktree。

### 同身份 Runtime 检查恢复

首次 parent 的 16 个平台/Node cell 与 unsupported guard 全部通过；Runtime child `36244908333` 成功，四个签名 bundle 与公开渠道已发布。parent 在随后的 releaseNotesUrl 断言失败：预构建 source `75e5ddea` 尚无结构化说明，签名 manifest 固定指向同版本 GitHub Release；closure tree 已包含后到的说明，检查器从该树改为期待文档站链接。它是来源时点混淆的误报，不是 Runtime 身份、内容或签名变化。

在原 notes reader 支持读取固定 Git revision，Runtime 检查按 prepared source 决定链接；未知 revision 与非法 metadata 保持 fail closed。新增 `--verify-only` 复用已发布资产和公开渠道，恢复不重上传签名 manifest/bundle。Runtime job 保留 immutable release tree，单独读取冻结的当前验证控制面，避免旧发布提交把修复后的检查器锁死。真实临时 Git 仓库回归证明说明后到不改变预构建期望，57 项定向测试、actionlint、治理和 diff-only maintainability 通过；本地 owning verifier 已核验四平台公开 manifest。

原 parent 的 workflow 与脚本已经冻结，failed-only rerun 无法使用新检查器。因此由同一 `release.yml` 的 existing recovery identity 分支复用 `nextclaw@0.57.2`，不建立新 package/version/tag。恢复 run [36245684318](https://github.com/Peiiii/nextclaw/actions/runs/36245684318)，`13:35:37Z` 创建，冻结验证控制面为 `c0afcb5e5ea15564bfa9c61e67fefd08f1d3c76b`。检查器修复提交 `1b9673870`，与期间到达的主干提交普通 merge 后推送，未重写其它任务历史。

恢复前按 CI 的 HEAD 基线确认没有待发布的产品包；并发主干仅有私有 Bibo 应用的说明变化，没有 NextClaw registry 新身份。本地主工作区的 master 落后导致默认 Changesets 比较报错，`--since HEAD` 与 CI materialized master 等价，结果为空，未为此添加伪 changeset。

NPM 阶段计时原本只写 stdout；本次让同一安全摘要追加到 `GITHUB_STEP_SUMMARY`，保留已有 job 摘要和本地 CLI 行为。尚未获得本批 artifact/package/Git 内部分项秒数，未从总体时长伪造瓶颈，也未声称这次已解决发布延迟。

版本说明部署 run `36244331212` 的双域构建、发布和一致性验证成功；两域 `nextclaw-v0.57.2.json` 均回读到中英文链接。canonical `docs.nextclaw.io` JSON 的 CORS 为 `*`；国内镜像未返回 CORS header，未声称该镜像支持跨域读取，本版 manifest 指向同版本 GitHub Release，不依赖国内镜像 JSON。

恢复 parent `36245684318` 在 `13:41:17Z` 成功闭合，proof 绑定 `version=0.57.2`、`sha=812922e2f1113620f0240381b47dcbd68bc38745`、`target=product`。GitHub [稳定 Release](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.57.2) 保留 darwin-arm64、darwin-x64、linux-x64、win32-x64 四个既有 zip，未改签或重建。四个平台公开 manifest 都为 `latestVersion=0.57.2`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`；[Linux stable manifest](https://peiiii.github.io/nextclaw/npm-runtime-updates/stable/manifest-stable-linux-x64.json) 代表同目录的平台入口，releaseNotesUrl 保持签名时的同版本 GitHub Release。

## 用户/产品视角的验收步骤

升级到 `nextclaw@0.57.2` 后刷新原聊天页，从原 HTTP／局域网入口发送普通消息、快捷键消息或菜单预设消息，预期消息正常进入接收确认与回复流程。已有配置和会话无需迁移。发布态精确包、默认更新渠道和真实旧版本升级证据均已闭合；没有声称升级了用户正在运行的实例。

## 可维护性总结汇总

同一发送 envelope producer 保持唯一；只替换消息 ID 的随机源，不增加 fallback、全局 polyfill、状态 owner 或协议。测试在独立 HTTP identity describe 中保护三条共用入口，避免扩大既有长 describe。diff-only maintainability 无错误，控制器临近文件预算提示经主观复核后接受这三行局部生产逻辑；既有测试 describe 的超行警告保留。新增说明与记录已通过 planned-path preflight。

## NPM 包发布记录

需要发布：HTTP 发送是用户可感知故障，UI 已有 patch changeset；`nextclaw` 内嵌 UI 必须同步更新。主干已有的独立 Bibo changeset 由既有统一版本流程处理，私人应用不进入 registry 发布集合。本次 NextClaw 用户变化是修复，产品级别采用 patch。

以下为预检冻结的 registry 发布集合，owning workflow 发布成功后逐包从公网 registry 回读；九个精确版本与 `latest` 标签全部一致：

| 包 | 目标版本 | 状态 |
| --- | --- | --- |
| nextclaw | 0.57.2 | 已发布，latest 一致 |
| @nextclaw/ui | 0.27.2 | 已发布，latest 一致 |
| @nextclaw/kernel | 0.19.0 | 已发布，latest 一致 |
| @nextclaw/harness | 0.2.26 | 已发布，latest 一致 |
| @nextclaw/remote | 0.3.69 | 已发布，latest 一致 |
| @nextclaw/server | 0.23.12 | 已发布，latest 一致 |
| @nextclaw/service | 0.7.6 | 已发布，latest 一致 |
| @nextclaw/client-sdk | 0.12.12 | 已发布，latest 一致 |
| @nextclaw/companion | 0.2.69 | 已发布，latest 一致 |

NPM job 在 `13:08:56Z–13:16:00Z` 完成，7 分 04 秒；距 dispatch 7 分 55 秒，`time budget: missed`。其中 prepared publish/Git closure step 为 6 分 24 秒；exact-SHA NPM artifact 到 `13:11:08Z` 才完成，workflow 内至少重叠等待了约 95 秒。Registry 各包首次发布时间跨 `13:12:12Z–13:15:30Z`，这只是可观察发布窗口，不能当作上传耗时或推断网络根因。

已复用 master push 预构建、并发发布、NPM/Runtime 并行准备和成功证据；没有重复 build/publish 的人工快速路径。发布耗时已连续超预算，确切内部瓶颈仍需 owner 的分阶段指标，不能通过顶层时长臆断，也不降低 identity、integrity、dist-tag 或安装门禁。

首次 dispatch 至恢复终态为 **33 分 12 秒**；同身份恢复为 **5 分 40 秒**。初始 Runtime promotion/Pages/公开检查窗口约 **77 秒**，满足 120 秒目标；恢复只读 Runtime 检查为 2 秒，真实旧版升级验证为 82 秒。初始 NPM 后的全平台兼容矩阵约 5 分钟，恢复的 registry/Git/历史证据准备约 2 分钟；未把这些顶层时长假称内部根因。已将 NPM 分阶段摘要补到既有 Actions 结果表面，文件追加与本地无 Actions 环境行为由测试证明；本次 recovery 跳过首次上传，未冒称它证明了未来新版本的计时展示或延迟优化。

`AUTOMATION_INTERVENTIONS: 1`：发现预构建与后到版本说明来源时点不一致的检查误报 → 修复固定 source reader 与独立验证控制面 → 在同一 `0.57.2` 身份恢复，复用本版 16 个 cell、包、标签、签名 manifest 与四个 bundle。发布准备、只读核验、原始 dispatch、既有文档自动部署和普通 Git 并发合并不计干预。
