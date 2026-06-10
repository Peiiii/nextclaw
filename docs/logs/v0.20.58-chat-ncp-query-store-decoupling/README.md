# v0.20.58 Chat NCP Query Store Decoupling

## 迭代完成说明

完成 NCP chat query store 解耦。根因是页面聚合 hook 混合 query、派生状态和多 store 写入；修复后 query sync 只写原始 query，query manager 只做相同快照跳过，业务组件按需读取 query store。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/ncp/hooks/__tests__/use-ncp-chat-derived-state.test.tsx src/features/chat/features/ncp/hooks/__tests__/use-ncp-chat-query-store-sync.test.tsx src/features/chat/managers/__tests__/ncp-chat-query.manager.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts src/features/chat/managers/__tests__/ncp-chat-input.manager.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/features/input/utils/__tests__/ncp-chat-input-availability.utils.test.ts`
- `pnpm --filter @nextclaw/ui tsc --noEmit`

覆盖 skeleton、input loading、header 和 query wrapper identity。

## 发布/部署方式

本次未执行部署。

## 用户/产品视角的验收步骤

打开 NCP chat 后，会话区和输入面板不应一直 loading；选中会话后 header 显示标题、runtime badge、项目 badge 和操作入口。

## 可维护性总结汇总

删除旧 page data 聚合 hook，新增 query manager/store/sync hook，并下沉最终消费点读取。后续清理 input/thread store 历史派生字段。

## NPM 包发布记录

涉及 `@nextclaw/ui`，已添加 patch changeset：`.changeset/chat-ncp-query-store-decoupling.md`。当前未发布，待统一发布。
