# v0.19.7 Weixin Asset Store Binding

## 迭代完成说明

- 修复本地安装实例在微信截图/附件读取后不回复的问题。
- 根因：`LocalAssetStore` 的公开实例方法会被 server/channel 边界作为函数引用传递，普通 class method 丢失 `this` 后触发 `this.getByUri is not a function`，随后微信扩展退出。
- 确认方式：安装实例日志在 `2026-05-22T04:33:31Z` 和重启复现时出现 `this.getByUri is not a function`，紧接着出现 `Extension nextclaw-channel-extension-weixin exited`。
- 修复方式：把 `LocalAssetStore` 的公开 API 收敛为箭头 class field，补充方法解构调用回归测试，并按当前治理规则补齐相关文件角色后缀与模块结构配置。

## 测试/验证/验收方式

- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime exec vitest run`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- `pnpm lint:new-code:governance -- packages/ncp-packages/nextclaw-ncp-agent-runtime`
- `pnpm check:governance-backlog-ratchet`
- 本地安装实例重启后验证 `http://127.0.0.1:55667/api/health` 返回 `ok`，日志确认 `weixin` 扩展启动且没有新的 `getByUri` / 微信扩展退出记录。

## 发布/部署方式

- 已本地构建 `@nextclaw/ncp-agent-runtime` dist。
- 已重启本地 NextClaw 安装实例，当前服务运行在 `http://127.0.0.1:55667`。
- 未执行远程部署；本次是本机运行时修复。

## 用户/产品视角的验收步骤

- 从微信发送普通消息，应该重新进入 NextClaw 微信通道并获得回复。
- 再请求截图或触发附件读取，服务日志不应再出现 `this.getByUri is not a function`。
- `logs/service.log` 中应保留 `Extensions started: ... nextclaw-channel-extension-weixin`，且后续无 `Extension nextclaw-channel-extension-weixin exited`。

## 可维护性总结汇总

- 使用 `post-edit-maintainability-guard`，非测试代码增减为 `+30/-33/net -3`。
- 正向减债动作：职责收敛与命名治理。`LocalAssetStore` 公开 API 现在自绑定，调用方不需要记住隐式 `this` 约束；相关文件补齐 `.store.ts`、`.service.ts`、`.utils.ts` 角色后缀。
- 保留债务：`local-asset.store.ts` 仍接近 400 行预算，后续可继续拆分 asset metadata、mime 推断与内容路径解析。

## NPM 包发布记录

- 不涉及 NPM 包发布。
- 若要让外部已安装用户获得该修复，后续需要纳入统一 NPM beta/stable 发布批次。
