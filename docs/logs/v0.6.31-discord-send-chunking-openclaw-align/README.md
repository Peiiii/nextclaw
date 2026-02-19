# 2026-02-20 v0.6.31-discord-send-chunking-openclaw-align

## 迭代完成说明（改了什么）

- 参考 `openclaw` 的 Discord 发送策略，在以下文件实现了长文本分片发送：
  - `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts`
- `DiscordChannel.send` 从“单条直接发送”改为“按分片循环发送”，避免超长消息触发 Discord `Invalid Form Body`。
- 新增分片逻辑（内置于同文件）：
  - 字符上限控制：`2000`（保守上限，兼容性更稳）
  - 行数软上限：`17`
  - 超长单行切分（优先按空白断开）
  - fenced code block 自动补全闭合，避免跨分片破坏 Markdown 结构
- 保留原有行为：
  - `replyTo` 透传
  - `silent`（`SuppressNotifications`）透传

## 测试 / 验证 / 验收方式

- 工程级验证（规则要求）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 验证结果：
  - 全部通过；存在既有 lint warning（与本次改动无关）：
    - `packages/extensions/nextclaw-channel-runtime/src/channels/mochat.ts` `max-lines`
    - `packages/nextclaw-openclaw-compat/src/plugins/loader.ts` `max-lines-per-function`
    - `packages/nextclaw/src/cli/commands/service.ts` `max-lines-per-function`
- 冒烟测试（真实 Discord 发送链路）：
  - 命令：`pnpm -C packages/extensions/nextclaw-channel-runtime exec tsx -e '<smoke script>'`
  - 方式：使用本地配置的 Discord token，发送 `8060` 字符超长文本到真实频道 `1471158891831361638`
  - 观察点：
    - 控制台输出 `SMOKE_OK`，未抛 `Invalid Form Body`
    - 证明分片逻辑已生效（旧逻辑下该长度会失败）

## 发布 / 部署方式

- 本次为 channel runtime 行为修复，发布建议：
  1) 通过 changeset 记录 `@nextclaw/channel-runtime` 版本变更
  2) 按依赖联动规则，同步评估并发布直接依赖包（如 `@nextclaw/openclaw-compat`、`nextclaw`）
  3) 执行：`pnpm release:version`
  4) 执行：`pnpm release:publish`
- 运行中服务生效方式：
  - 重启网关服务：`pnpm -C packages/nextclaw dev:build restart`
