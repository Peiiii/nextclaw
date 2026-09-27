# Bibo 会话保存故障修复与部署

## 迭代完成说明

修复已合入远程 master 并部署至生产；整体 AI 验收尚有日配额阻塞。用户要求“bibo 这里经常遇到这样的问题。复现修复发布”，截图标示“结果未能保存，请重试。输入已保留，可重新发送。”附件中的其它对话内容只作现场线索。

根因：快照递归复制了由会话日志生成的消息投影；后台对 meta 临时文件做原子重命名，复制期间 `lstat` 触发 ENOENT。线上日志于 2026-09-27T04:58:27Z 命中该路径。本地在持续 SQLite WAL 写入及 meta 写入/重命名期间复现 `/snapshot` 500 与同一 ENOENT。修复精确排除 canonical journal 下的派生投影目录，保留日志及 SQLite online backup；不吞正式文件错误，不泛化排除用户文件。设计见 [修复方案](../../designs/2026-09-27-bibo-snapshot-persistence.design.md)。

## 测试/验证/验收方式

Active acceptance ledger（contract-id: bibo-snapshot-persistence-20260927）：

| ID | Required | Status | 当前证据 |
| --- | --- | --- | --- |
| BIBO-SAVE-01 | true | passed | 修前同边界 500 ENOENT；修后 snapshot 测试成功、journal/用户文件保留、无派生投影、SQLite quick_check ok |
| BIBO-SAVE-02 | true | passed | cold replay 覆盖六轮工具消息、投影缺失重建与再次冷重载，8 项恢复测试通过；旧归档格式及 restore 路径未变 |
| BIBO-SAVE-03 | true | passed | 集成 master 后 Bibo 三份 tsc、29 项服务端测试、Vite 构建、独立动态端口 product smoke、desktop/mobile composer smoke 通过；原 WAL/SSE、kernel 冷恢复及 targeted lint 证据有效 |
| BIBO-SAVE-04 | true | blocked | 冻结部署、镜像内修复、100% rollout、线上快照提交、75 秒后文件重读、桌面/手机刷新历史、实际 inactive→running 后恢复及再次快照提交通过。新镜像连续模型对话及恢复后的模型上下文仍待验收：专用账号日配额接口返回 429 |

## 发布/部署方式

仅发布 Bibo 托管 Worker/Container，用户授权覆盖本服务提交、主线集成、推送及部署。从冻结远程 master 的干净 worktree 执行 `pnpm -C apps/bibo-hosted run deploy`；使用项目指定 Wrangler 4.138.0。线上旧 Worker 版本 `8ed59b77-81c4-4048-8728-55d5120202c6`，旧容器 application version 16、镜像 digest `b4d776c1bfc62db0fa06afe2ea39f81b77893046564a9d442dc8b11baec5bf27`，保留回退入口。无数据迁移，旧快照兼容；不涉及 NextClaw NPM/runtime/desktop。

前期 worktree 以本地 master 起步；修复提交 `fc986ad22` 后合并远程 master `be98e4aca`，合并结果 `bdee4dd60` 保留最新 Bibo 领域模块、会话模型和生命周期改进。唯一冲突是 README 的快照说明，已保留双方有效说明。集成后重做匹配验证。预检使用主线更新后的专用 smoke，在生成提交后读取历史时遇到本机连接超时；这不作为根因复现证据。浏览器固定预览端口被其它任务占用，改用仓库外恢复材料生成动态端口副本复验成功；未修改或停止其它任务服务。并发验证期间旧 restore 测试曾出现 429，去除重复运行后完整 29 项测试通过。

实际部署从干净远程 master `69165bc30063331cbc468d5e764d4a6eecf1fb6e` 执行。Worker `ceadbb39-b898-461f-9b76-246b372d0732`，Container version 17、digest `fc4abf90af447ebb0e16ee337cd3bba4079289315de9f8ee52a1cc6496fa7023`。发布入口成功，首次 Docker 隔离配置遗漏 buildx 插件路径导致构建前失败，补齐已安装插件目录后重跑成功；构建等待约 6 分钟，未中断发布进程。`AUTOMATION_INTERVENTIONS: 1`，介入点为 Docker 配置；后续自动化落点应由既有发布入口承载插件路径解析，不为此次单例增加治理脚本。

其它 Bibo 任务随后从包含本修复的 master 部署。验收时当前 Worker 为 `b6d4a724-1b37-4f63-8bdc-3aae8a659694`、Container version 19，digest `f060bf2ed90fdafdc07c570b495921b5e1505bf4e4bb449db7f8fddfb6e5ace0`，rollout 100%。直接读取该 Docker 镜像内 runner 确认快照目录排除条件存在；专用账号实际实例命中同一 digest。version 18 镜像亦确认含修复。任务 worktree 快进至集成 master `1b0e04a77`，未重发旧镜像覆盖其它任务。

生产证据：会话 `4c335311-d988-4295-941e-bf9c25ca39dc` 首轮曾在旧 version 16 committed（10 个 delta、7426ms）；滚动替换期间第二轮失败，该结果不计作新镜像验收。version 19 下模型请求先后受到并发 429 与日配额 429 限制。独立存储验收通过 `file.create` 触发真实快照提交，75 秒后 `file.get` 内容一致，会话原两条消息一致；桌面 1365px 与手机 390px 刷新仍显示标记，无 pageerror 或横向溢出，随后仅删除本轮测试文件。后续控制面确认实例于 05:36:35Z inactive；从该状态触发真实文件操作，05:38:35.572Z running，原快照 restore 成功、再次快照提交及新测试文件读写删除通过，会话历史一致。整个验证实际使用 version 19 digest。该链路不消耗模型额度，但不替代连续模型对话或模型上下文判定。恢复材料位于任务 worktree 的 ignored `.local`，截图 `/tmp/bibo-snapshot-storage-live-{1365,390}.png`。

远程主线已发布；源区仍保留任务开始时的一份已有修改与四份未跟踪 thought。`release:reconcile:mainline` 返回 `LOCAL_WORKTREE_RETRYING`，自动 retry owner 负责等待安全快进；未 stash/reset/rebase 或覆盖 WIP。模型验收恢复条件：另一个已登录且可用的专用测试账号，或 UTC 次日额度恢复。已向用户请求选择，保留 Required ID 04，不缩减合同。

## 用户/产品视角的验收步骤

登录 https://app.bibo.bot/ → 发送消息 → 等待保存结束 → 刷新仍见本轮对话 → 容器休眠后继续上一段对话。AI 已验证本地完整交互以及线上存储/刷新部分；新镜像完整模型链路待额度恢复后完成。未将截图中的用户账号用于测试。状态：已发布，AI 验收部分阻塞，尚未取得用户验收。

## 可维护性总结汇总

快照 owner 继续归 Bibo runner；复用原复制、压缩、SQLite backup、R2/DO 提交与 journal 恢复主链路，没有新状态、重试或公共抽象。根因对应的并发边界进入既有测试；运行说明更新原 README，作为本次复盘沉淀。planned-path preflight、governance 和 ratchet 通过。冷恢复测试最初放入 journal 大文件触发文件预算，已移入职责匹配的 tool-tail recovery 现有测试，最终 maintainability diff 检查 0 errors / 0 warnings，targeted lint 通过。implementation Review: no findings。普通修复不进入博客发布。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/bibo-hosted` 是私有托管 app，用户可见 bugfix 记入 changeset，实际交付为 Worker 与 Container 部署。
