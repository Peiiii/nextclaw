# 发送反馈纠偏与 0.57.3 发布

## 迭代完成说明

修复已交付主线，0.57.3 正式发布成功。用户明确指出普通发送时突然出现的“正在确认消息是否已接收…”卡片不可接受，并澄清队列不是本次问题。`260eae4fb` 的移动草稿保护实现把后台发送记录直接渲染在输入区，每次发送都新增卡片并重复全文；源码及旧实现两项失败回归确认这一边界。修复只在拒绝或结果不明时展示恢复卡片，保留原草稿、幂等及队列 owner。修复提交 `6376a187c`，冻结发布源 `f796dcbe3a8fccb597863de257bea286e1207a85`。

## 测试/验证/验收方式

合入远端已有 HTTP 消息 ID 修复后，发送反馈组件、草稿 store 与控制器 34 项回归通过；UI tsc、定向 ESLint、治理检查通过。源码组件浏览器回放证明普通发送顶部额外高度为 0px，排队仅有一条 32px 队列行，结果不明保留重试入口。此渲染证据不冒充真实模型回复。原设计与本次纠偏见 [移动端发送草稿回填](../../designs/2026-09-24-移动端发送草稿回填.design.md)。

## 发布/部署方式

用户授权修复后发布新版本。采用现有 GitHub Actions `release.yml target=product`，只 dispatch 一次，expected_head 固定为上述源；工作流 [36248722694](https://github.com/Peiiii/nextclaw/actions/runs/36248722694) 负责 NPM、stable Runtime、真实升级和兼容性矩阵。发布前 dry-run 与 release health 通过。Desktop 安装包不属于常规产品发布目标。

父流程在 2026-09-26 14:50:39 UTC 成功结束：NPM、16 个平台/Node 组合、低版本 Node 拒绝、四平台 Runtime 与上一 stable 真实升级均通过。公开 Linux manifest 已核对 `latestVersion=0.57.3`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`，releaseNotesUrl 指向同版本 GitHub Release；其余平台公开入口由 owning workflow 核验。[发布说明](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.57.3) 使用面向用户的双语修复说明。

总 wall time 1225 秒（20 分 25 秒）；从 dispatch 到 NPM job 成功为 458 秒（7 分 38 秒），`time budget: missed`。job 级计时：NPM 发布 405 秒、Windows Node 26 安装验证 542 秒、Runtime 发布与升级验证 209 秒。最长关键等待为 Windows Node 26；这些是 Actions job wall time，不能替代 publisher 内部子阶段计时。本次未改发布实现或增加人工快速通道，发布 owner 完成同一 identity 的预构建消费和收尾；性能瓶颈留作该 owner 的证据，不在 UI 修复中猜测网络或构建根因。`AUTOMATION_INTERVENTIONS: 0`，未重发版本或重跑发布。

发布提交及两包标签均指向 `bdeef19c5a88917f89bb8ef6fde749fd8fdcadc5`，与远端 master 的 branch-closure 检查通过。本地主线因原 tracked WIP 保持原状，`release:reconcile:mainline` 返回 `LOCAL_WORKTREE_RETRYING`，已有单例 worker 自动接管，无用户同步待办。

## 用户/产品视角的验收步骤

升级到 0.57.3，发送“你好”：输入框清空且不出现接收确认卡片；回复期间追加消息，排队项只出现一次。网络中断或明确拒绝时，原内容仍可核查或恢复，新草稿不会被覆盖。

## 可维护性总结汇总

复用原组件与 store，删除正常发送卡片分支及失效中英文文案，没有新增状态或协议。专属小测试文件保护渲染与异常恢复边界，避免继续扩大已有超预算测试文件。最终 diff-only maintainability 无错误、无警告；无需追加主观复核。复盘更新原设计 owner，未新增常驻规则。主工作区原有五项 thought 改动未纳入提交。

## NPM 包发布记录

已发布 `nextclaw@0.57.3` 与 `@nextclaw/ui@0.27.3`，两包进入 latest；原因是输入区用户可见修复。Registry identity、integrity/latest 及空缓存精确 tarball 审计由成功的 NPM job 证明。本机 registry 直连遭遇 TLS 重置，未将本机失败查询冒充成功；正式公网安装与升级证据来自 GitHub Actions。发布前源工作区 WIP 未纳入版本提交。
