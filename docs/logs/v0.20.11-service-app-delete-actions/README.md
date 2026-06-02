# v0.20.11 服务应用删除与动作入口修正

## 迭代完成说明

本次补齐服务应用的删除闭环，并修正服务应用卡片上的动作入口可理解性。

关键完成项：

- `ServiceAppManager` 新增 `deleteServiceApp`，删除前关闭对应 MCP runtime，删除服务应用目录，并清理该服务应用对应的 action grants。
- Server 新增 `DELETE /api/service-apps/:appId`，client SDK 新增 `deleteServiceApp`。
- UI 服务应用面板新增删除 hook、更多菜单、确认弹窗和删除后 query invalidation。
- 服务应用卡片上的动作入口从“发现运行时动作”调整为“连接并发现动作”，图标从容易误解为搜索的 `Search` 改为 `Radar`，并复用统一 `Tooltip` 组件补齐 hover 说明。
- 服务应用状态不再裸展示内部枚举 `idle/running/failed`，也不再包装成容易误解的业务运行态；统一按运行时连接态展示为“未连接 / 连接中 / 已连接 / 连接失败 / 已停止”，并用 tooltip 解释状态变化。
- “重启服务应用”调整为“断开连接”，并使用断开连接图标，避免用户误以为它一定会立刻启动或重连服务；当前语义是断开 runtime 并回到未连接状态。
- 顺手将 `router.register` 中资源类路由抽到 `mountResourceRoutes`，消除新增 route 推高函数长度预算的问题。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/service-app.manager.test.ts`
  - 结果：通过，1 个测试文件、8 个测试。
- `pnpm --filter @nextclaw/server test -- src/features/service-apps/controllers/service-apps.controller.test.ts`
  - 结果：通过，1 个测试文件、7 个测试。
- `pnpm --filter @nextclaw/ui test -- src/features/service-apps/components/service-apps-panel.test.tsx`
  - 结果：通过，1 个测试文件、1 个测试；覆盖动作按钮 label、删除确认，以及 `idle` 状态不再裸露为内部枚举。
- `pnpm --filter @nextclaw/kernel tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/server tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/client-sdk tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui exec eslint <服务应用 UI 触达文件>`
  - 结果：通过，0 error / 0 warning。
- `pnpm --filter @nextclaw/kernel exec eslint <服务应用 manager/store/test 触达文件>`
  - 结果：通过，0 error / 0 warning。
- `pnpm --filter @nextclaw/server exec eslint <服务应用 route 触达文件>`
  - 结果：通过，0 error / 0 warning。
- `pnpm --filter @nextclaw/client-sdk exec eslint src/services/service-apps.service.ts`
  - 结果：通过，0 error / 0 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次触达文件列表>`
  - 结果：0 error，2 warning；warning 为 `packages/nextclaw-client-sdk/src/services` 与 `packages/nextclaw-server/src/app` 既有目录预算超限，本次未新增这些目录的直接文件。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。

## 发布/部署方式

本次尚未发布、未部署、未提交。当前只是本地实现和验证。

## 用户/产品视角的验收步骤

1. 打开右侧栏 Apps -> Service Apps。
2. 确认每个服务应用卡片上“连接并发现动作”不再显示搜索图标，hover 后能看到它会连接运行时并发现动作的 tooltip。
3. 确认服务应用状态显示为本地化连接状态徽标，例如“未连接 / Not connected”“已连接 / Connected”，而不是 `idle` 这类内部枚举。
4. hover “连接并发现动作”“断开连接”和“更多操作”按钮，确认都有 tooltip，且“连接并发现动作”的说明明确它会连接运行时。
5. 确认未连接状态下“断开连接”入口置灰不可点，避免无效动作看起来可执行。
6. 点击更多操作，选择删除服务应用。
7. 在确认弹窗中确认删除，确认该服务应用从列表消失。
8. 刷新服务应用列表，确认被删除的目录不会重新出现。
9. 若该服务应用曾授权给 Panel App，确认对应 action grants 被清理。

## 可维护性总结汇总

本次是新增用户可见能力，非测试代码增长属于必要增长。实现保持单一路径：

- 删除语义 owner 在 `ServiceAppManager`，负责 runtime 生命周期、目录删除和 grant 清理。
- Server/controller 只暴露 HTTP 合同，不复制删除逻辑。
- Client SDK 只承接 API 调用。
- UI 只通过 hook mutation 调用删除，并复用现有 `ConfirmDialog`、`Popover`、`Tooltip`。

代码增减报告：

- 新增：400 行。
- 删除：75 行。
- 净增：325 行。

非测试代码增减报告：

- 新增：255 行。
- 删除：68 行。
- 净增：187 行。

正向减债动作：职责收敛。新增 DELETE route 的同时把资源类 routes 从 `router.register` 中抽到 `mountResourceRoutes`，避免继续推高巨型注册函数。

## NPM 包发布记录

不涉及 NPM 包发布。
