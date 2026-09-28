# Bibo 异步向用户提问

日期：2026-09-29。状态：已实现，待线上验收。上位语义见 [原生 Agent 异步提问](2026-09-28-async-user-questions.design.md)；本设计只负责 Bibo 托管入口、提交边界与界面。

## 用户链路与验收

登录 Bibo 后，用户提出需要偏好才能定稿的任务。原生 Agent 调用同一个 `request_user_input_async` 工具，给出建议项、可选推荐项与可选解释，然后继续完成独立工作。Bibo 提交本轮回答和 Agent 快照后，在回答旁显示可点击的问题标签，输入框上方自动出现紧凑面板。用户可关闭并从标签重新打开；点建议项直接作答，自定义项输入后发送，也可跳过。答案在会话中以原问题为引用，送回同一 Agent 会话；Agent 后续回复、题目终态和其它未答题一起持久保存。刷新、切换会话和重新登录仍能恢复。

黄金验收：① 真实模型发问并继续本轮，推荐标记和仅有解释时的问号在桌面及手机可见；② 关闭面板再打开，单击选项回答，引用与 Agent 回复正确，刷新仍在；③ 两题逐题回答／跳过，另一个题目保持待答，重复或竞争提交不产生第二条答案；④ 回答生成或快照提交失败时正式历史不前进，用户能重试。视觉偏好由用户验收，状态、协议、刷新和失败恢复由 AI 自验。

## 现状与取舍

现有 Bibo runner 每轮创建 Harness，但工具白名单不含异步提问；Durable Object 只保存 `{role,text,at}` 简化会话，并在 Container 快照写入 R2 后才提交历史。Worker 按已认证账号路由到唯一用户容器。直接给 Bibo 增加独立提问表会和 Kernel journal 形成两个状态 owner；把答案拼成普通聊天文本则丢失 `questionId`、幂等和引用关系。故问题仍由 Kernel `UserQuestionManager` 创建与结算；Harness 公开窄的列题和结算并等待回复能力。Bibo 的简化历史只保存 Kernel 问题的提交后投影，用于网页阅读。Client SDK 负责解析该投影，不让 React 猜测文本。

## 主链路与边界

1. Runner 给 Bibo 的原生 Agent 开放 `request_user_input_async`。本轮完成时向 Harness 查询全量问题，把结果随原有 `/run` 结果返回。Bibo DO 在同一次快照提交中把新问题挂到本轮 assistant 消息；既有问题的终态按 Kernel 投影更新。未提交的流式内容不成为正式问题。
2. 用户对某题作答或跳过，Client SDK 走鉴权 Worker → 本人 DO → Container → Harness → Kernel `UserQuestionManager`。Kernel 构造含问题 ID、原题和答案的标准用户消息，经原生 Agent 输入主链路送入同会话，并等待 Agent 回复。Container 返回回复和最新问题投影。DO 把带引用的用户消息、Agent 回复、问题终态与 Container 快照一起提交；提交失败则重启容器回滚到上一次快照。
3. DO 在每账号单次运行锁内串行结算；跨账号由账号容器隔离。当前 Bibo 的快照事务不允许在上一轮生成或保存期间并发提交第二条消息；问题可在本轮结束后操作，Agent 发问本身仍不阻塞本轮。这里是 Bibo 的托管提交边界，不改变 Native Web 的运行中插话能力。Bibo 不新增轮询或付费服务。
4. UI 用与 composer 同宽同层的临时面板；新问题首见自动打开，关闭后可点消息内标签重开。推荐项有轻量标记；仅有解释时出现独立问号，鼠标悬停、键盘聚焦、触控点按均可读，点问号不提交。回答引用仅显示原题摘要，状态以图标／标签表达。选项直接提交，自定义项常显且单行输入不改变高度；答后面板关闭，待答入口只在需要找回旧题时显示。

状态来自 Kernel journal；DO 的消息附件是原子提交后的阅读投影。用户刷新只读取 DO 正式历史，不把一次失败运行留下的未提交问题当成可回答。问题回答结算同一 ID 幂等，冲突答案拒绝；普通消息不因文字相似被误认为回答。旧消息没有附件时按普通历史展示。密码与审批需要独立安全合同，不借用本次普通文本答案。

## 传播与验证

Producer：Kernel 工具与 `UserQuestionManager` → Harness 公共入口 → Container JSON/SSE → DO 快照与简化消息 → Worker 鉴权路由 → Bibo Client SDK 校验 → Zustand 状态 → React/共享控件。新闭集事件不增加；在现有 committed 消息中扩展可选字段。验证 Kernel/Harness、Client SDK、Bibo Worker/runner/web 三处 `tsc`、定向测试、构建、桌面与手机真实浏览器，以及上线后的账号隔离、提交和刷新。文档站与 Bibo 帮助同步。交付按 `apps/bibo-hosted/AGENTS.md`：提交、合入并推送主干，从冻结远程主干部署 `app.bibo.bot` 后复验；不发布其它产品。

设计依据：用户 2026-09-28 的 Native 范围、Codex 对照截图与多轮交互纠偏，以及随后明确的 Bibo 支持要求；本次用户补充的可选问号解释和推荐提示复用已完成的 Kernel 结构化字段。`docs/VISION.md` 的长期搭档与统一会话要求，验收由同一问题 ID 和同一 Agent journal 保证。

design-document: required；plan: not-required（单一纵向链路、按现有提交顺序逐层实现并验证）。
