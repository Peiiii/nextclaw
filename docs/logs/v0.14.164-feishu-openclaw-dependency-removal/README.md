# 迭代完成说明

- 将 `@nextclaw/channel-plugin-feishu` 对 `openclaw/plugin-sdk/*` 的直接运行时依赖替换为插件包内的 `src/nextclaw-sdk/*` 薄兼容层。
- 删除 [`packages/extensions/nextclaw-channel-plugin-feishu/package.json`](/tmp/nextbot-feishu-release-1774358544/packages/extensions/nextclaw-channel-plugin-feishu/package.json) 中的 `openclaw` 依赖，避免再次把 OpenClaw 宿主运行时带入 NextClaw 飞书插件发布物。
- 删除 [`packages/nextclaw-openclaw-compat/src/plugins/shims/pi-coding-agent.ts`](/tmp/nextbot-feishu-release-1774358544/packages/nextclaw-openclaw-compat/src/plugins/shims/pi-coding-agent.ts) 与对应 loader alias，纠正上一版误把事故兜底逻辑发进正式运行时的问题。
- 保持 `openclaw/plugin-sdk` alias 仅作为通用 external plugin compat 能力，不再让官方飞书插件自身依赖它。
- 顺手把薄兼容层中的品牌泄漏纠正为 NextClaw 语义：文档链接默认指向 `https://docs.nextclaw.io`，pairing/approval 文案不再暴露 OpenClaw 品牌。

# 测试/验证/验收方式

- `pnpm --filter @nextclaw/channel-plugin-feishu lint`
- `pnpm --filter @nextclaw/openclaw-compat lint`
- `pnpm --filter @nextclaw/openclaw-compat build`
- `NEXTCLAW_HOME=$(mktemp -d /tmp/nextclaw-feishu-smoke-XXXXXX) pnpm --filter nextclaw dev:build plugins list --json`
- 观察点：
  - `feishu` 插件状态为 `loaded`
  - 插件加载过程不再要求 `openclaw` 包存在
  - 日志中不再出现 `pi-coding-agent` shim 相关接线

# 发布/部署方式

- 新建 patch changeset，覆盖以下发布包：
  - `@nextclaw/channel-plugin-feishu`
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/server`
  - `nextclaw`
- 执行：
  - `pnpm release:version`
  - `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- 发布后再次执行 CLI 冒烟，确认 registry 侧安装到的新版本仍能正常列出 `feishu` 插件。

# 用户/产品视角的验收步骤

1. 安装刚发布的 patch 版本 `nextclaw`。
2. 执行 `nextclaw plugins list --json`，确认返回结果里 `feishu` 为 `loaded`。
3. 检查飞书插件包的安装产物，确认其 `package.json` 不再声明 `openclaw` 依赖。
4. 用默认未配置飞书账号的环境启动，确认只出现 “No Feishu accounts configured” 类跳过日志，不出现 OpenClaw SDK/runtime 缺失错误。

# 红区触达与减债记录

### packages/extensions/nextclaw-channel-plugin-feishu/src/channel.ts

本次是否减债：否  
说明：本次主要是替换 SDK 依赖入口，没有继续扩张 `channel.ts` 逻辑。  
下一步拆分缝：后续可把配置 schema、status/onboarding、directory 安全告警再拆成独立表面层。

### packages/extensions/nextclaw-channel-plugin-feishu/src/bot.ts

本次是否减债：否  
说明：本次没有继续向 `bot.ts` 注入新业务逻辑，只切换了 helper 来源。  
下一步拆分缝：后续可把媒体解析、pairing、路由鉴权、reply dispatch 桥接继续拆分成独立模块。
