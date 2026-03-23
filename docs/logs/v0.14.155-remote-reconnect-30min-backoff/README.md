# v0.14.155-remote-reconnect-30min-backoff

## 迭代完成说明

- 将 remote connector 的非终止性失败重连策略从“指数退避到 60 秒 + 连续 6 次失败后熔断停止”调整为“持续指数退避，最高退避到 30 分钟”。
- 保留终止性错误的立即停止策略：token 失效、缺失 bearer token、401/403/404、非法 URL、协议不支持等仍然不自动重连，避免在认证/配置错误下无意义打平台。
- 移除了针对普通 websocket 失败的固定失败次数熔断，让长时间平台/网络波动期间无需手动 repair 也能持续尝试自动恢复，同时把请求频率压得更低。
- 更新 `remote-connector-runtime.test.ts`，将原先“第 6 次失败后停止”的断言改为“退避序列增长直到 30 分钟上限”。

## 测试/验证/验收方式

- 定向测试：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/remote-connector-runtime.test.ts`
- 类型检查：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-remote tsc --pretty false`
- 定向 lint：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm exec eslint packages/nextclaw-remote/src/remote-connector.ts packages/nextclaw-remote/src/remote-connector-retry.utils.ts packages/nextclaw/src/cli/commands/remote-connector-runtime.test.ts`
- 构建验证：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-remote build`
- 冒烟测试：
  - 在 `/tmp/nextclaw-remote-backoff-smoke.mjs` 中加载编译后的 `@nextclaw/remote`，模拟持续 websocket `ECONNREFUSED`，观察延迟序列。
  - 实际观察结果：`3000, 6000, 12000, 24000, 48000, 96000, 192000, 384000, 768000, 1536000, 1800000`，确认已经退避到 30 分钟上限。
- 可维护性闸门：
  - `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-remote/src/remote-connector.ts packages/nextclaw-remote/src/remote-connector-retry.utils.ts packages/nextclaw/src/cli/commands/remote-connector-runtime.test.ts`
  - 结果：无阻塞项；`remote-connector.ts` 仅保留“接近预算线”警告，但本次文件体积是下降的。

## 发布/部署方式

- 本次需要发包的组件：
  - `@nextclaw/remote`
  - `nextclaw`
  - `@nextclaw/server`
  - `@nextclaw/mcp`
- 发布流程：
  1. 创建 changeset。
  2. 运行 `pnpm release:version`。
  3. 运行 `pnpm release:publish`。
  4. 发布后核对 npm registry 上的版本与 manifest。

## 用户/产品视角的验收步骤

1. 安装本次发布后的 `nextclaw` 新版本并保持 remote access 开启。
2. 在平台短暂不可用或本地网络波动时，观察日志，确认远程访问不会在 6 次失败后直接停死。
3. 继续观察日志，确认重连间隔持续拉长，并最终能退避到 30 分钟量级。
4. 在平台恢复后，无需手动 repair，等待下一次自动重连即可恢复在线。
5. 若是 token 过期、401/403 等认证/配置错误，确认系统仍然立即停止并提示重新登录/修复，而不是盲目重试。
