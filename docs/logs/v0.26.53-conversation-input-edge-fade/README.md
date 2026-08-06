# 会话输入边缘渐隐

## 迭代完成说明

- 普通会话内容在输入区上方增加 28px 底部渐隐，并预留等高内容安全区，末条消息不会落入不可读区域。
- 欢迎态不应用渐隐，保持首屏内容完整显示。
- 渐隐参数从侧栏私有样式收敛到共享 `ScrollArea` 视觉合同，左侧会话列表和主会话内容使用同一个 owner。
- 未增加遮挡点击的覆盖层、React effect、兼容分支或第二套滚动链路。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/components/conversation/__tests__/chat-conversation-content.test.tsx src/app/components/layout/__tests__/sidebar.layout.test.tsx`：2 个文件、14 条测试通过。
- 在 `HEAD + staged diff` 临时 worktree 中运行完整 `pnpm --filter @nextclaw/ui tsc`：通过。主工作树的同一命令被并行未暂存改动中的两处类型错误阻塞：一处测试仍传入已移除的 `statusKind`，另一处会话区域把可空 `SessionEntryView` 传给非空参数。
- `pnpm --filter @nextclaw/ui lint` 与 `pnpm --filter @nextclaw/ui build`：通过；构建仅保留既有大 chunk 提示。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`：通过。
- 源码实例真实页面验收：普通桌面与 `900x720` 视口均可见输入区上方的柔和渐隐，浏览器计算样式为 28px 线性 mask，最后一条内容保留 28px 安全间距；`520x800` 视口确认渐隐样式仍生效。

## 发布/部署方式

- 本轮只完成本地源码改造与验证，未部署、未发布，也未重启 NextClaw 宿主或服务。
- 不涉及数据库 migration、后端服务或运行时协议变更。

## 用户/产品视角的验收步骤

1. 打开已有消息的任务，确认内容在输入框上方柔和淡出，而不是突然被输入区截断。
2. 滚动到最后一条消息，确认正文完整可读，没有落入渐隐末端。
3. 切换到欢迎态，确认首屏不出现多余渐隐；对比左侧会话列表，确认两处边缘过渡一致。

## 可维护性总结汇总

- 本次任务自身总代码 `+29/-12/net +17`，其中非测试代码 `+10/-11/net -1`，满足非功能改动生产语义代码不净增的门槛。
- 正向减债是把侧栏私有渐隐常量上移为共享滚动表面合同，并删除消息发送状态中的一处冗余条件；未新增文件层级、manager、helper、adapter、effect 或兼容分支。
- `post-edit-maintainability-guard` 为 0 error；共享 UI 目录保留一条已有预算例外，目录文件数没有增加。
- `post-edit-maintainability-review` 结论：通过。视觉 owner 更集中，滚动与消息生命周期未改变。

## NPM 包发布记录

- `@nextclaw/ui` 需要 patch changeset，状态为待统一发布。
- 本轮未执行 NPM 发布。
