# v0.13.41 Chat Sticky Autoscroll Dead Code Remove

## 迭代完成说明（改了什么）

- 删除 chat 列表旧的 `MutationObserver` 自动滚动实现（已被新的 sticky 跟随机制替代，且在实际场景中不再是主生效路径）。
- 保留并继续使用当前有效的 sticky 跟随策略：
  - 底部阈值判定（10px）；
  - `uiMessages` 流式更新时在 sticky 状态下自动 `scrollToBottom()`；
  - 用户手动上滑超过阈值后脱离 sticky。
- 清理后滚动逻辑更单一，减少重复触发与维护成本。

## 测试/验证/验收方式

- 执行命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- 结果：命令均通过。
- 冒烟建议：
  - 在底部/底部 10px 内触发流式输出，确认持续自动跟随；
  - 手动上滑超过阈值，确认不再自动贴底；
  - 回到底部后确认 sticky 恢复。

## 发布/部署方式

- 本次为前端代码清理，不涉及后端与数据库，无需 migration。
- 按前端发布流程执行 `/release-frontend`（或等效流程）。

## 用户/产品视角的验收步骤

1. 打开 chat，保持滚动条在底部（或距离底部 10px 内）。
2. 触发流式输出，确认内容持续自动跟随到底部。
3. 手动向上滚动超过 10px，确认自动跟随停止。
4. 再次回到底部，确认自动跟随恢复。
