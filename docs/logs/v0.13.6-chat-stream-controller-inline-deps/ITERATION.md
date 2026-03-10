# 迭代完成说明（改了什么）
- 将 `StreamRunController` 内依赖入参的工具逻辑收敛到 class 内部方法，执行路径直接基于 `this.manager` + `this.payload` 使用。
- 移除对 `buildParams`/外部工具函数的依赖，减少函数透传和中间层。
- 将 `clearStreamingState` 下沉为 `ChatStreamManager.clearStreamingState()`，避免函数式透传。

# 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/chat-stream/stream-run-controller.ts`
- `pnpm -C packages/nextclaw-ui tsc --noEmit`
- `pnpm -C packages/nextclaw-ui exec vite build --outDir /tmp/nextclaw-ui-smoke`

# 发布/部署方式
- 不适用（本次未执行发布/部署）。

# 用户/产品视角的验收步骤
1. 进入 Chat 页面。
2. 发送一条消息，观察发送与回复链路是否正常。
3. 终止一次正在进行的回复，确认 UI 状态能正确恢复。
