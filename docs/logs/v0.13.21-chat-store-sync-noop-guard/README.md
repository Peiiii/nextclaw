# v0.13.21-chat-store-sync-noop-guard

## 迭代完成说明（改了什么）

- 修复 chat 前端潜在循环更新根因：`ChatPage` 多路 `syncSnapshot` 在无数据变化时仍持续写入 store，造成不必要的高频重渲染。
- 为以下 manager 增加“无变化不写入”守卫，切断 no-op 更新链路：
  - `ChatSessionListManager`
  - `ChatInputManager`
  - `ChatThreadManager`
  - `ChatRunStatusManager`（包含 `Map` 内容级比较）
- 对常用 setter（query / selectedSessionKey / selectedModel / draft 等）增加相同值短路，避免重复写入。
- 相关方案文档：[`2026-03-10-chat-runtime-agent-align.md`](../../designs/2026-03-10-chat-runtime-agent-align.md)

## 测试/验证/验收方式

- 已执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui lint`
  - `pnpm --filter @nextclaw/ui build`
  - `pnpm --filter @nextclaw/ui dev --host 127.0.0.1 --port 4173` + `curl -s http://127.0.0.1:4173/`
- 结果：
  - `tsc/build` 通过。
  - `lint` 无 error，仅存在仓库既有 warning。
  - 本地 dev 服务可正常启动并访问首页。

## 发布/部署方式

- 本次为前端状态同步稳定性修复，按常规 UI 发布流程发布。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库）。

## 用户/产品视角的验收步骤

1. 打开 chat 页，持续发送消息并切换会话，确认不再出现 `Maximum update depth exceeded`。
2. 观察会话列表、输入区、线程区在无实际数据变化时不再出现明显抖动刷新。
3. 验证发送链路：用户消息不消失，assistant 不重复，流式输出正常。
