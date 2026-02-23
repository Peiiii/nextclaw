# 2026-02-23 v0.8.10-plugin-disable-state-sync

## 背景 / 问题

- UI 插件管理中，执行 `disable` 后卡片状态未同步为 Disabled。
- 对 Discord 插件执行 `disable` 后，运行时仍可继续通过 Discord 对话，禁用未真正生效。
- 进一步排查热插拔链路后，发现还存在同类隐患：当服务启动时配置文件尚不存在，文件监听可能漏掉首轮配置创建事件，导致热重载不稳定。

## 迭代完成说明（改了什么）

- `packages/nextclaw-openclaw-compat/src/plugins/loader.ts`
  - 修复 bundled channel plugins（含 Discord）未读取 `plugins.entries.*.enabled` 的问题。
  - bundled 插件现在与外部插件一致，统一通过 `resolveEnableState(...)` 判定启用状态（含 `allow/deny/enabled` 规则）。
  - 当配置为禁用时，插件记录状态标记为 `disabled` 并跳过注册，不再启动对应运行时通道。
- `packages/nextclaw-server/src/ui/router.ts`
  - 新增插件管理目标 ID 归一化：当 UI 传入 `spec`（如 `@nextclaw/channel-plugin-discord`）时，先映射到真实插件 ID（如 `builtin-channel-discord`）再执行 enable/disable/uninstall。
  - 避免写入错误配置键导致“UI 看起来没变化”。
- `packages/nextclaw/src/cli/commands/service.ts`
  - 修复热重载监听隐患：从“直接监听 config 文件”改为“监听 config 所在目录并精确过滤到目标 config 文件路径”。
  - 解决配置文件初始不存在时，首轮 `plugins disable/enable` 可能不触发热重载的问题。

## 自动化回归测试（新增）

- `packages/nextclaw-openclaw-compat/src/plugins/loader.bundled-enable-state.test.ts`
  - 覆盖 bundled Discord 插件在以下场景的启停判定：
    - `plugins.entries.*.enabled=false`
    - `denylist`
    - `allowlist`
    - 重新 enable 后恢复 loaded 与 channel 注册
- `packages/nextclaw-server/src/ui/router.marketplace-manage.test.ts`
  - 覆盖 `/api/marketplace/manage` 使用 canonical spec 时的目标 ID 归一化，确保最终执行目标为 `builtin-channel-discord`。

## 测试 / 验证 / 验收方式

执行命令：

```bash
# 新增回归测试
pnpm -C packages/nextclaw-openclaw-compat test -- --run src/plugins/loader.bundled-enable-state.test.ts
pnpm -C packages/nextclaw-server test -- --run src/ui/router.marketplace-manage.test.ts

# 全量工程验证
pnpm build
pnpm lint
pnpm tsc
```

端到端热插拔冒烟（实际已完成两轮）：

1. 轮次 A（含 init）：先 `init --force` 生成 config，再启动 `serve`。
2. 轮次 B（无 init）：直接启动 `serve`（验证“配置文件首次创建”场景）。
3. 两轮都执行：`Discord disable -> enable`（并在一轮额外验证 Slack disable/enable）。

关键观察点（两轮均满足）：

- `POST /api/marketplace/manage` 传 `id/spec=@nextclaw/channel-plugin-discord`，返回 `data.id=builtin-channel-discord`。
- `GET /api/marketplace/installed` 中 Discord 记录在 disable/enable 时可来回切换：
  - `enabled: true, runtimeStatus: loaded`
  - `enabled: false, runtimeStatus: disabled`
  - 再回到 `enabled: true, runtimeStatus: loaded`
- 服务日志出现热重载闭环：
  - `Config reload: plugin channel gateways restarted.`
  - `Config reload: plugins reloaded.`
  - `Config reload: channels restarted.`

验证结论：

- 新增回归测试通过。
- `build` 通过。
- `lint` 通过（仅仓库既有 warning，无新增 error）。
- `tsc` 通过。
- 热插拔闭环在“有 config / 首次创建 config”两种场景都可稳定生效。

## 发布 / 部署方式

- 本次为代码修复提交，尚未执行 NPM 发布。
- 若需发布，按项目流程执行：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
- 本次变更不涉及后端数据库结构，不需要 migration。

## 用户 / 产品视角的验收步骤

1. 启动服务并进入 UI 的 Marketplace/Installed 页面，定位 Discord 插件。
2. 点击 `Disable`。
3. 预期：卡片状态立即显示 `Disabled`。
4. 通过 Discord 发送消息。
5. 预期：不再触发对话处理（通道插件已停用）。
6. 点击 `Enable`。
7. 预期：卡片恢复为 `Enabled`，Discord 消息恢复可用。

## 同类问题排查结果

- 已排查 bundled 插件启停判定链路，确认之前仅 bundled 路径未统一走 `resolveEnableState`，现已修正。
- 已排查 UI 管理接口入参映射链路，确认 canonical spec 与 pluginId 失配问题已修正并加测试覆盖。
- 已排查热重载触发链路，确认“配置文件首轮创建”场景存在监听隐患，现已修复。
- 目前未发现同级别未覆盖路径；新增测试与双场景冒烟可持续防回归。

## 影响范围 / 风险

- 影响范围：`@nextclaw/openclaw-compat`、`@nextclaw/server`、`nextclaw`。
- Breaking change：否。
- 风险点：文件监听改为目录监听后，若未来对 data 目录写入策略有变更，需要继续保持“按目标 config 路径精确过滤”。
- 回滚方式：回退上述三个文件改动并重新构建。
