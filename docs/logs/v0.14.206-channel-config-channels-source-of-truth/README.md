# v0.14.206-channel-config-channels-source-of-truth

## 迭代完成说明

- 将渠道配置真值源收口到 `channels.<id>`，不再把渠道业务配置继续写回 `plugins.entries.<pluginId>.config`
- 保留历史 plugin channel config 的读取投影视图，用于兼容之前已经落到 `plugins.entries.*.config` 的旧配置
- 修复 CLI `channels login`、UI 渠道授权、CLI `config get/set/unset channels.*` 的桥接逻辑，统一基于渠道视图工作
- 修复 Weixin 渠道运行时读取路径，使其改为读取 `channels.weixin`
- 扩展核心 `ChannelsConfigSchema`，允许并保留插件渠道键，避免 `channels.weixin` 一类配置在 `ConfigSchema.parse/loadConfig` 时被裁掉
- 修复 plugin channel gateway 启动上下文，补齐 `cfg / abortSignal / setStatus`，避免 Feishu 这类插件渠道在启动时因上下文不完整而报错
- 增加 plugin channel gateway 的启停守卫：若投影后的 `channels.<id>.enabled !== true`，则不再因为历史 `plugins.entries.*.config` 残留而误启动已禁用渠道
- 补充回归测试，明确“历史 plugin config 只作读取兼容，新写入必须落到 `channels.*`”

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- --run src/config/schema.plugin-channels.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/channel-runtime.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/channel-config-view.test.ts src/cli/commands/config.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- --run src/ui/router.weixin-channel-auth.test.ts src/ui/router.weixin-channel-config.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-openclaw-compat tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
- 隔离 home 冒烟：
  - `NEXTCLAW_HOME=/tmp/nextclaw-channel-smoke-5C2XyP NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR=/Users/peiwang/Projects/nextbot/packages/extensions PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build serve --ui-port 19097`
  - `curl -sf http://127.0.0.1:19097/api/health`
  - `curl -sf http://127.0.0.1:19097/api/config | jq '.data.channels | {discord,qq,feishu,weixin}'`
  - 观察日志：`QQ bot connected`、`Discord bot connected`、`Discord slash commands registered for 2 guild(s)` 已出现；不再出现 `Feishu ... reading 'channels'` 启动错误；`channels.feishu.enabled=false` 时不再误启动 Feishu gateway
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-channel-plugin-weixin/src/index.ts packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-config.ts packages/nextclaw-core/src/config/schema.ts packages/nextclaw-core/src/config/schema.plugin-channels.test.ts packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.ts packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.test.ts packages/nextclaw-openclaw-compat/src/plugins/types.ts packages/nextclaw-server/src/ui/channel-auth.ts packages/nextclaw-server/src/ui/router.weixin-channel-auth.test.ts packages/nextclaw-server/src/ui/router.weixin-channel-config.test.ts packages/nextclaw/src/cli/commands/channels.ts packages/nextclaw/src/cli/commands/config.ts packages/nextclaw/src/cli/commands/config.test.ts packages/nextclaw/src/cli/commands/channel-config-view.ts packages/nextclaw/src/cli/commands/channel-config-view.test.ts packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/config-reloader.ts`

## 发布/部署方式

- 本次为本地代码与配置链路修复，无独立部署脚本变更
- 按常规版本发布流程发布受影响包即可；发布后重点验证 CLI、UI 配置页、渠道授权与服务重载链路
- 若发布包含桌面/UI 发行物，确保新构建内的配置编辑与渠道授权都以 `channels.*` 为最终持久化结果

## 用户/产品视角的验收步骤

1. 打开配置文件或使用 `nextclaw config get channels.<channel>`，确认渠道配置内容位于 `channels.<channel>`
2. 在 UI 中修改 Weixin/Discord 等渠道配置并保存，确认保存后刷新页面仍能看到相同配置
3. 触发渠道授权或登录流程，确认授权成功后配置写入 `channels.<channel>`，而不是只出现在 `plugins.entries.*.config`
4. 重启或热重载服务，确认渠道仍能按保存后的配置正常启动与响应
5. 若本地仍有历史 `plugins.entries.*.config` 渠道配置，确认系统可读；一旦通过 UI/CLI 再次保存后，最终持久化结果应归于 `channels.*`
