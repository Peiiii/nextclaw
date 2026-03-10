# v0.13.30-chat-session-refresh-history-race-fix

## 迭代完成说明（改了什么）
- 修复“会话页刷新后回到新会话页、历史不加载”的核心竞态问题：
  - 在 `ChatPage` 的 `chatSessionListManager.syncSnapshot` 调用中，移除对 `selectedSessionKey` 与 `selectedAgentId` 的冗余回写。
  - 保留会话列表数据同步（`sessions/query/isLoading`），避免渲染帧里的旧值覆盖由路由解析写入的新会话 key。
- 效果：刷新 `/chat/:sessionId` 时，路由解析得到的会话 key 不再被覆盖，`useSessionHistory(selectedSessionKey)` 可正常启用并拉取历史消息。

## 测试/验证/验收方式
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui build`
- 结果：均通过。

## 发布/部署方式
- 本次仅涉及前端 `@nextclaw/ui` 代码。
- 按现有前端发布流程执行构建产物部署即可；如有灰度环境，优先灰度验证会话刷新与历史加载链路。

## 用户/产品视角的验收步骤
1. 打开任意已有会话，确认地址为 `/chat/:sessionId`。
2. 直接刷新浏览器页面（硬刷新与普通刷新都执行一次）。
3. 验证页面仍停留在该会话（不是“新会话欢迎态”）。
4. 验证历史消息自动加载并展示，无需再次手动点击会话。
