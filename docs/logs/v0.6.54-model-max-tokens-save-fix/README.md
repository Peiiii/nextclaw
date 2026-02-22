# v0.6.54-model-max-tokens-save-fix

## 迭代完成说明（改了什么）

本次修复前端 Model 页面“`maxTokens` 修改后保存、刷新回旧值”的问题，打通前后端保存链路。

- 前端 Model 页面提交参数新增 `maxTokens`（此前只提交 `model`）
  - [`packages/nextclaw-ui/src/components/config/ModelConfig.tsx`](../../../packages/nextclaw-ui/src/components/config/ModelConfig.tsx)
- UI API `updateModel` 支持传入 `maxTokens`
  - [`packages/nextclaw-ui/src/api/config.ts`](../../../packages/nextclaw-ui/src/api/config.ts)
- 服务端 `/api/config/model` 支持 `{ model?, maxTokens? }`，并在更新后返回最新值
  - [`packages/nextclaw-server/src/ui/router.ts`](../../../packages/nextclaw-server/src/ui/router.ts)
  - [`packages/nextclaw-server/src/ui/config.ts`](../../../packages/nextclaw-server/src/ui/config.ts)
- 使用文档补充 Model 页面保存行为说明
  - [`docs/USAGE.md`](../../../docs/USAGE.md)

## 测试 / 验证 / 验收方式

- 工程验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟验证（非仓库目录）：
  - 在 `/tmp` 下设置独立 `NEXTCLAW_HOME`，调用服务端 `updateModel` 更新 `maxTokens` 后重新读取配置。
  - 观察点：更新前后 `agents.defaults.maxTokens` 数值变化，并在重新加载后保持新值。

### 用户/产品视角验收步骤

1. 打开 UI 的 Model 页面。
2. 修改 `Max Tokens` 滑杆数值并点击保存。
3. 刷新页面。
4. 确认 `Max Tokens` 显示仍为刚刚保存的数值，不再回退。
5. 运行时验证：发起一轮对话，确认输出长度上限行为符合新值预期。
6. 验收标准：Model 页面配置“可保存、可回显、可生效”。

## 发布 / 部署方式

- 发布流程参考：[`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md)
- 发布命令：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`
- 远程 migration：不适用（本次仅 UI/API/配置写入链路修复）。
