# v0.14.143-weixin-ui-qr-auth-flow

## 迭代完成说明

- 为 `weixin` 独立插件补齐了渠道授权 `start/poll` 能力，扫码会话由插件内部管理，授权成功后由 UI server 自动落盘到插件配置。
- 为 UI server 新增 `POST /api/config/channels/:channel/auth/start` 与 `POST /api/config/channels/:channel/auth/poll`，前端不再需要直接操作微信底层登录细节。
- 将前端 `weixin` 渠道页改成“扫码连接微信”主流程，默认首屏显示连接状态、二维码、轮询结果与已连接账号；底层字段折叠到“高级设置”。
- 将本轮新增的微信授权类型、API、hooks、多语言文案拆分到独立模块，避免继续放大已有超长公共文件。

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/channel-plugin-weixin tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui tsc`
- 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server test -- router.weixin-channel-config.test.ts router.weixin-channel-auth.test.ts server.weixin-channel.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui test -- ChannelsList.test.tsx`
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/openclaw-compat build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/channel-plugin-weixin build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw build`
- 真实冒烟：
  - 使用临时 `NEXTCLAW_HOME` 启动 `node packages/nextclaw/dist/cli/index.js start --ui-port 18893 --start-timeout 20000`
  - 请求真实 `/api/config/meta`，确认 `weixin` 出现在渠道列表中
  - 请求真实 `/api/config/channels/weixin/auth/start`，确认返回 `sessionId / qrCodeUrl / expiresAt / intervalMs`
- 可维护性检查：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：无阻塞项；保留 6 条 warning，均为历史超长公共文件或本轮明显增长但仍在预算内的文件

## 发布/部署方式

- 按 changeset 流程提升受影响包版本后发布到 NPM。
- 受影响包至少包括：
  - `@nextclaw/openclaw-compat`
  - `@nextclaw/channel-plugin-weixin`
  - `@nextclaw/server`
  - `@nextclaw/ui`
  - `nextclaw`
- 发布后用 `npm view <package> version` 校验线上版本，并再次执行一次真实 `nextclaw start` 冒烟确认 UI 渠道列表和扫码接口正常。

## 用户/产品视角的验收步骤

1. 升级到本次发布后的 `nextclaw`，启动服务并打开前端配置页。
2. 进入 `Channels`，确认列表中可以看到 `Weixin`。
3. 点开 `Weixin` 后，首屏应直接看到“扫码连接微信”卡片，而不是先看到一堆底层字段。
4. 点击“扫码连接微信”，页面应展示二维码，并自动轮询扫码状态。
5. 手机扫码并确认后，页面应显示已连接状态，账号信息应自动写入配置。
6. 仅当需要自定义 `baseUrl`、账号映射或白名单时，再展开“高级设置”。
