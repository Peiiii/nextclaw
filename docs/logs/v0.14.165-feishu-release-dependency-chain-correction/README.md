# 迭代完成说明

- 对上一轮飞书插件纠偏发布做依赖链补发：将 `@nextclaw/openclaw-compat` 再升一个 patch，并同步发布 `@nextclaw/server`、`@nextclaw/mcp`、`nextclaw`，确保入口包不再指向旧的 `@nextclaw/openclaw-compat@0.3.20`。
- 本轮不改动飞书插件实现本身，目标是修正“已发布包之间的版本连接关系”，让用户从 npm 安装 `nextclaw` 时真正拿到包含飞书纠偏的依赖链。

# 测试/验证/验收方式

- `npm view nextclaw@<new-version> dependencies --json`
- `npm view @nextclaw/server@<new-version> dependencies --json`
- `npm view @nextclaw/openclaw-compat@<new-version> version dist-tags --json`
- `NEXTCLAW_HOME=$(mktemp -d /tmp/nextclaw-feishu-registry-smoke-XXXXXX) pnpm dlx nextclaw@<new-version> plugins list --json`
- 观察点：
  - `nextclaw` 与 `@nextclaw/server` 的线上依赖都指向新的 `@nextclaw/openclaw-compat`
  - registry 安装态下 `feishu` 插件可正常 `loaded`

# 发布/部署方式

- 新建 patch changeset，覆盖：
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/server`
  - `@nextclaw/mcp`
  - `nextclaw`
- 执行：
  - `pnpm release:version`
  - `NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`

# 用户/产品视角的验收步骤

1. 安装新发布的 `nextclaw` patch 版本。
2. 检查 `nextclaw` 依赖清单，确认 `@nextclaw/openclaw-compat` 已升级到本轮新版本。
3. 运行 `nextclaw plugins list --json`，确认 `feishu` 插件依然是 `loaded`。
4. 在未配置飞书账号的默认环境下，确认只出现跳过日志，不出现 OpenClaw 依赖缺失错误。
