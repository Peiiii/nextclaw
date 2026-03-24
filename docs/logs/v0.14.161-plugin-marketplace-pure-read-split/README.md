# 迭代完成说明

- 将插件 marketplace 的“读”与“执行”彻底拆开：
  - `discoverPluginStatusReport(...)` 负责纯读 discovery，只读 manifest / config / bundled 候选，不导入插件运行时代码。
  - `buildPluginStatusReport(...)` 继续保留为真实 runtime load 路径，仅供需要执行插件装载的场景使用。
- 将插件已安装列表接口切到 pure-read discovery 路径，避免页面进入时把 read 请求变成隐式插件装载。
- 将插件 marketplace 列表接口改为直接透传远端分页参数，不再为了前端一页数据先抓取整份远端目录再本地分页。
- 为上述行为补了回归测试，并对已安装列表聚合逻辑做了 helper 拆分，确保可维护性闸门通过。
- 方案文档：[`docs/plans/2026-03-24-plugin-marketplace-pure-read-split.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-24-plugin-marketplace-pure-read-split.md)

# 测试/验证/验收方式

- pure-read vs full-load 回归：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat test -- --run src/plugins/status.pure-read.test.ts src/plugins/loader.bundled-enable-state.test.ts src/plugins/loader.ncp-agent-runtime.test.ts`
- server 路由回归：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server test -- --run src/ui/router.marketplace-installed.test.ts src/ui/router.marketplace-content.test.ts src/ui/router.marketplace-manage.test.ts`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server tsc`
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server build`
- lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server lint`
- maintainability：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-openclaw-compat/src/plugins/status.ts packages/nextclaw-openclaw-compat/src/plugins/status.pure-read.test.ts packages/nextclaw-server/src/ui/router/marketplace/installed.ts packages/nextclaw-server/src/ui/router/marketplace/plugin.controller.ts packages/nextclaw-server/src/ui/router.marketplace-installed.test.ts packages/nextclaw-server/src/ui/router.marketplace-content.test.ts`
- 请求级冒烟：
  - `/api/marketplace/plugins/installed` 应返回已安装插件信息，且不会触发 probe 插件模块导入。
  - `/api/marketplace/plugins/items?page=2&pageSize=12` 应只请求一次远端 marketplace，并保留 `page=2&pageSize=12`。

# 发布/部署方式

- 本次变更属于服务端读取链路与兼容层逻辑修复，本地验证不需要先发布。
- 若要让外部安装用户获得同样行为，需要按常规发布流程发布至少以下受影响包：
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/server`
- 发布后应在 registry 安装环境再做一次插件 marketplace 冒烟，确认：
  - 进入插件页不会重复触发插件装载。
  - 已安装列表仍能展示 bundled / external / config-only 插件状态。
  - 远端插件列表分页仍按请求参数返回，而不是退回整表抓取。

# 用户/产品视角的验收步骤

1. 启动本地 NextClaw 服务并进入插件 marketplace 页面。
2. 反复进入页面或刷新页面，确认页面明显更快，且不会因为进入页面就触发插件安装/装载动作。
3. 打开“已安装插件”列表，确认外部插件、bundled 插件、仅配置插件仍能正常展示启用状态、运行状态和安装 spec。
4. 在插件列表切到第 2 页并设置 `pageSize=12`，确认页面正常显示对应分页数据。
5. 对一个真实已安装插件执行启用、禁用、卸载等手动操作，确认这些显式操作仍然正常可用。
