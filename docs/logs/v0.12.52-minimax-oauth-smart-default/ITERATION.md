# v0.12.52 MiniMax OAuth Smart Default

## 迭代完成说明（改了什么）
- MiniMax OAuth 授权区域默认值改为更符合中文用户预期：后端兜底默认从 `global` 调整为 `cn`。
- 前端 Provider 配置页新增授权方式智能默认策略：
  - `minimax-portal` 在中文界面优先选 `cn`。
  - `minimax-portal` 在英文界面优先选 `global`。
  - 其它 provider 仍按原有 `defaultMethodId` / 首项回退。
- 增加服务端测试，覆盖“未传 `methodId` 时 MiniMax OAuth 默认走 `cn`”的行为。

## 测试/验证/验收方式
- 单测：`pnpm -C packages/nextclaw-server test -- --run src/ui/router.provider-test.test.ts`
- 全量静态与构建验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟：`node scripts/platform-mvp-smoke.mjs`

## 发布/部署方式
- 本次为前后端配置逻辑与 UI 行为调整，无额外 migration。
- 按常规流程完成合并后发布包含 `nextclaw-server` / `nextclaw-ui` 的版本即可。

## 用户/产品视角的验收步骤
1. 打开 UI 的 Provider 页面，选择 `minimax-portal`。
2. 在中文界面下进入 MiniMax OAuth 区域，确认授权区域默认选中“中国区（CN）”。
3. 点击“浏览器授权”，观察请求走 `api.minimaxi.com`。
4. 切换到英文界面后重新进入该页面，确认默认选中 `Global`。
5. 不手动选择授权区域时发起授权，确认系统可成功完成 OAuth 并回填 token。
