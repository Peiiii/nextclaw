# 2026-02-23 v0.8.15-discord-streaming-preview

## 迭代完成说明（改了什么）

- 继续使用 `@nextclaw/channel-plugin-discord`，在 `@nextclaw/channel-runtime` 内实现 Discord 预览流式输出（编辑消息实时更新）。
- 新增 Discord 流式配置：`channels.discord.streaming`、`channels.discord.draftChunk`、`channels.discord.textChunkLimit`。
- 发送逻辑按 openclaw 语义对齐：`partial/progress` 走较细粒度预览流，`block` 走较大块更新，`off` 保持原有分片发送。
- 更新配置帮助/标签与使用文档说明。

## 测试 / 验证 / 验收方式

- 工程级验证（规则要求）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 执行结果：当前环境缺少 `node/pnpm`，命令未能执行（需在具备 Node.js 与 pnpm 的环境补跑）。
- 冒烟测试（Discord 实机）：
  - 需要可用的 Discord bot token 与频道 ID。
  - 建议命令：
    - `TMP_HOME=$(mktemp -d /tmp/nextclaw-discord-streaming-smoke-XXXXXX)`
    - `NEXTCLAW_HOME="$TMP_HOME" pnpm -C packages/nextclaw dev:build -- config set channels.discord.streaming '"partial"' --json`
    - `NEXTCLAW_HOME="$TMP_HOME" pnpm -C packages/nextclaw dev:build -- message send --channel discord --target channel:<CHANNEL_ID> --text 'smoke: streaming preview test...'`
  - 观察点：消息先出现并持续编辑更新，最终文本完整且无 `Invalid Form Body` 错误。
  - 执行结果：当前环境缺少 `node`，未能执行（需具备 Node.js 后补跑）。

## 发布 / 部署方式

- NPM 发布按流程执行：[`docs/workflows/npm-release-process.md`](../../../workflows/npm-release-process.md)
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
  - 执行结果：当前环境缺少 `node/pnpm`，未执行（需补跑后再发布）。

## 用户 / 产品视角验收步骤

1. 在配置中启用 Discord 并设置 `channels.discord.streaming` 为 `partial` 或 `block`。
2. 从 Discord 发送一条较长消息触发回复。
3. 观察机器人回复先出现预览消息并持续编辑更新，最终呈现完整文本。
4. 将 `streaming` 设为 `off`，确认恢复为原始一次性/分片发送。
