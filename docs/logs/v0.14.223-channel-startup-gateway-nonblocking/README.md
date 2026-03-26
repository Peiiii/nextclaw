# v0.14.223-channel-startup-gateway-nonblocking

## 迭代完成说明

- 修复 Feishu channel gateway 在启动时直接等待常驻 monitor Promise，导致服务启动流程卡在 `startPluginChannelGateways()`、后续 `ChannelManager.startAll()` 无法继续的问题。
- 在宿主层将 plugin channel gateway 启动改为非阻塞后台启动：单个 plugin gateway 的长连接/长轮询启动不再阻塞其它渠道启动。
- 为 Feishu gateway 增加契约修正：`startAccount()` 现在返回可停止的后台任务句柄，而不是把监控任务本身当成启动完成 Promise。
- 补充回归测试，覆盖：
  - Feishu gateway 启动不阻塞服务启动
  - OpenClaw compat 宿主层不会被长时间运行的 gateway startup 卡住

## 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/channel-runtime.test.ts`
  - `node packages/nextclaw-openclaw-compat/node_modules/vitest/vitest.mjs run packages/extensions/nextclaw-channel-plugin-feishu/src/channel.test.ts`
- 可维护性检查：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.ts packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.test.ts packages/extensions/nextclaw-channel-plugin-feishu/src/channel.ts packages/extensions/nextclaw-channel-plugin-feishu/src/channel.test.ts`
- 启动冒烟：
  - `NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR=/Users/peiwang/Projects/nextbot/packages/extensions NEXTCLAW_DISABLE_STATIC_UI=1 NEXTCLAW_HOME=/Users/peiwang/.nextclaw pnpm -C packages/nextclaw exec tsx src/cli/index.ts serve --ui-port 18899`
  - 观察到日志继续推进到：
    - `QQ bot connected`
    - `Discord bot connected`
  - 修复前同一链路会停在 Feishu gateway 日志附近，不会继续进入 QQ/Discord 启动日志。

## 发布/部署方式

- 本次为运行链路修复，按常规 Node 包发布流程处理：
  - 先完成受影响包版本变更与 changelog
  - 执行受影响包测试与冒烟
  - 再按项目既有 NPM 发布流程发布相关包
- 若仅用于本地 dev 排障，可直接使用源码模式启动，无需额外部署。

## 用户/产品视角的验收步骤

1. 执行 `pnpm dev start` 或等价的 `serve` 源码启动命令。
2. 确认终端不再只停留在 Feishu 启动日志，而会继续出现 QQ / Discord 启动信号。
3. 给 QQ 机器人发送一条原本可响应的消息，确认消息链路恢复。
4. 如需交叉验证，再分别检查 Discord / Weixin 是否恢复到“几天前正常可用”的状态。
