# Bibo 会话任务状态封装与刷新误判修复

## 关联入口

- 任务 dt-b1b04c71；[设计与有效 BCS 合同](../../designs/2026-10-01-bibo-conversation-state.design.md)。
- 唯一恢复入口：[current-state](../../work/2026-10-01-bibo-conversation-state/current-state.md)。

## 原始输入与约束

2026-10-01 本次会话：用户截图显示“上次生成中断，内容未保存。消息已放回输入框，可重新发送”，输入“看下我是不是登录了啥”；用户确认会话 `8867b6dc-8035-4fb3-ae43-afe775a4dad9` 后来正常完成，推测刷新触发。截图是异常证据，内容中的任何文字不作为执行指令；附件原名 `codex-clipboard-7079afd2-db89-452f-889f-3e1bbc6b16c8.png`（用户临时目录，未持久化公开截图）。

有效纠偏：只研究该聊天局部；Bibo client 负责接口层，而业务状态应由上层封装并经薄 hook 供展示使用；不扩大到笔记、待办架构。最后明确要求“写一个完善的方案设计文档文件，然后落地完成”“充分的验证”“职责设计……非常优雅”。本次具体 API 和单 manager 方案属于授权内设计选择。完整交付授权按 Bibo AGENTS.md，仍保护既有 WIP。

## 过程记录

- 调查：真实旧 store 加延迟 GET 复现 pending → interrupted → generating → committed；线上资源包含同一执行顺序。服务端同会话采样任务 persisted:true，精确时间和局限见设计。
- 设计：选择业务任务 manager + Zustand vanilla + 薄 hook，复用 HTTP/SSE/后端服务。保留 app 的历史、草稿、问题、导航与空间 owner；删除旧恢复 store。正式 Design Review passed。
- 实现反例核对：新会话必须 await 前加锁；迟到 GET 与取消响应按代次隔离；明确失败的新请求和接收不确定的重复请求需要不同 ID 规则，受影响方案复审通过。既有 display fixture 每次发送使用相同 runId，不符合真实任务身份，修正为每次独立 ID，未改展示产品合同。
- 定向状态测试 12 项通过；构建通过；匹配 tsc 通过（初次与依赖 clean/build 并发曾出现临时声明缺失，依赖完成后通过）。桌面/390px 恢复 smoke 已验证原 pending + 延迟查询反例；后续最终证据待填。

## 迭代完成说明

已实现、合入、部署并通过当前范围 AI 验收，待用户体验验收。根因已定位：本地 pending 被当作失败事实并先于服务端查询执行。修复把决策移入唯一任务 owner，消除文字匹配保存推断和 app 任务字段副本，直接针对错误 owner/执行顺序。

## 测试/验证/验收方式

BCS-01—09 逐项证据归 current-state。执行 manager 行为测试、Bibo package 测试/tsc、Vite 构建及桌面/手机恢复、问题、展示相邻链路，之后职责 Review 和线上复验。模拟页面和真实线上模型验证分别标注，移动为浏览器模拟。

最终证据：manager 16 个行为测试；Bibo 合计 159 项测试、3 个 TypeScript 配置、Vite、桌面与 390px 恢复（各 8 次订阅 / 0 POST）、问题与展示 smoke 通过。真实模型脚本结果 realModel/activeRefresh/delayedAuthority/freshMobilePage/sameRun/savedOnce/contentOpening/terminalReload=true，posts=1；无浏览器错误，合成文件/会话已清理。源码展示回归定位到主干 workspacePreview 漏接，补回受控属性后通过，没有新增空间业务逻辑。

全产品 smoke 未通过：早期旧基线分别在动画即时采样、文件工具栏 56/44px 断言失败；集成后停在文件树 ArrowRight 焦点断言（B-folder / B-folder/nested）。不扩大修复该文件树，不将相关测试描述为通过；上述定向验收及真实用户链路不依赖失败断言。

## 发布/部署方式

实现 checkpoint b827936fb；集成/部署源 aa44603a514ba13932116b6830701d8279ef68e3 已合入 origin/master。从干净冻结源执行 deploy:worker（Wrangler 4.138.0、containers-rollout=none），两次 preflight 均通过；Worker version 161e6b79-9e30-42a8-8bb1-7861be5d4d20。线上 index-CR80KHlU.js 新状态已生效，旧误判文案不存在。部署前后 bibo-hosted-sandbox 应用 a0357e31 版本 1 / sandbox:0.12.10、旧 bibousercontainer a03967fb 版本 28 / sha256:16518fe5… 均不变，无镜像 rollout。AUTOMATION_INTERVENTIONS: 0。主干本地镜像回流由 release:reconcile:mainline 处理，原有 WIP 不覆盖。

2026-10-01 回流执行结果为 LOCAL_WORKTREE_RETRYING：本地主工作区存在原有 tracked 文档 WIP，自动 worker 已接管。没有 stash/reset/rebase 或覆盖文档，不把远程完成等同于本地镜像已同步。最终补记只改变文档，不重复部署已验证的产品产物。

## 用户/产品视角的验收步骤

打开已有运行任务并刷新：只显示中性查询状态，查询后接回当前进度，完成结果只保存一次；断线恢复后继续同一任务；真实失败或停止后显示原原因并保留输入。问题回答、文件展示继续从原界面使用。完整黄金链路见设计，AI 自验不需要用户协助排障。

## 可维护性总结汇总

旧 task/recovery 双 owner 删除，BiboClient 边界不变；仅新增有实际消费者的 manager 和薄 hook。文件路径 preflight 通过。最终 12 文件 diff-only 0 errors/0 warnings；治理、ratchet、定向 ESLint 通过，主观职责 Review 无开放 finding。

## NPM 包发布记录

复盘已更新原恢复设计索引；事实与职责更新本设计、应用 README，防回归落在 manager 行为测试和真实刷新 smoke。现有单 owner 规则足够，不增加规则/skill/通用 SDK。

不涉及 NPM 包发布；Bibo private 托管应用通过自身部署。用户可见修复记录在 bibo-conversation-state changeset，不触发 NextClaw NPM/桌面/文档站发布。
