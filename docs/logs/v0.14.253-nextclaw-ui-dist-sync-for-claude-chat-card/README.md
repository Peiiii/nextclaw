# 迭代完成说明

- 补齐上一轮 `@nextclaw/ui` consumer 对齐后的 `packages/nextclaw/ui-dist` 构建产物提交。
- 将最新 `nextclaw-ui` 构建结果同步到仓库内置 UI 分发目录，确保仓库源码、已提交的 consumer 适配层和内置静态产物一致。
- 本轮不再变更 Claude / chat card 逻辑本身，只补齐构建产物留档与提交闭环。

# 测试/验证/验收方式

- 构建命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- 构建结果校验：
  - 确认 `packages/nextclaw/ui-dist/index.html` 与 `packages/nextclaw/ui-dist/assets/*` 已更新为最新 hash 产物。
  - 确认旧 hash 文件被移除，新 hash 文件已生成。
- 发布状态核对：
  - `PATH=/opt/homebrew/bin:$PATH pnpm view @nextclaw/ui version`
  - 当前 registry 版本已是 `0.11.4`，本轮只补 git 构建产物，不重复发布。

# 发布/部署方式

- 无需重新执行 npm 发布。
- 本轮仅补齐仓库内置静态资源目录 `packages/nextclaw/ui-dist` 的提交。
- 若后续再触发 `@nextclaw/ui` 源码改动，仍按常规 `build -> version/publish` 流程处理，并同步提交新的 `ui-dist`。

# 用户/产品视角的验收步骤

1. 使用仓库内置 UI 资源启动 NextClaw。
2. 进入聊天页，确认工具卡片与文件卡片展示与共享 `@nextclaw/agent-chat-ui` 对齐。
3. 确认页面静态资源能正常加载，没有因为旧 hash 残留导致 404 或样式错乱。
4. 确认仓库内置 UI 与 npm 已发布的 `@nextclaw/ui@0.11.4` 表现一致。
