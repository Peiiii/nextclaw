# v0.14.182-feishu-plugin-startup-config-fix

## 迭代完成说明

- 修复 `nextclaw` 启动插件通道网关时未向 `listAccountIds/defaultAccountId` 传入运行时配置的问题，避免飞书插件在启动阶段因 `cfg` 为 `undefined` 直接崩溃。
- 将插件网关账号枚举改为基于投影后的 plugin config view，保证 bundled/plugin channel 的账号解析读取到正确的 `channels.<channelId>` 视图。
- 为飞书账号解析补齐“缺少 cfg 时不崩”的保护，回退到 `default` 账号而不是让服务进程退出。
- 新增插件网关启动回归测试，覆盖“启动阶段会把投影配置传进账号枚举逻辑”的场景。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat exec vitest run src/plugins/channel-runtime.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.ts packages/nextclaw-openclaw-compat/src/plugins/channel-runtime.test.ts packages/extensions/nextclaw-channel-plugin-feishu/src/accounts.ts packages/extensions/nextclaw-channel-plugin-feishu/src/accounts.test.ts packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/service-plugin-reload.ts`
- 已知验证缺口：`packages/extensions/nextclaw-channel-plugin-feishu/src/accounts.test.ts` 在当前工作区无法直接独立执行，原因是该包本地测试依赖解析不完整，非本次修复逻辑报错。

## 发布/部署方式

- 合并后按既有 NPM 发布流程联动发布 `@nextclaw/openclaw-compat`、`@nextclaw/channel-plugin-feishu`、`nextclaw` 以及所有直接依赖受影响包的组件。
- 发布前再次执行受影响包的类型检查与回归测试。
- 发布后用已启用飞书通道的真实配置执行一次 `nextclaw restart` 冒烟，确认 UI/API 健康检查恢复正常。

## 用户/产品视角的验收步骤

1. 在已有飞书配置的环境执行 `nextclaw restart`。
2. 确认 CLI 不再输出 `Failed to start background service`。
3. 确认 `http://127.0.0.1:9808/api/health` 可访问，且服务日志中不再出现 `Cannot read properties of undefined (reading 'channels')`。
4. 若配置了多个飞书账号，确认对应账号通道都能正常启动。
