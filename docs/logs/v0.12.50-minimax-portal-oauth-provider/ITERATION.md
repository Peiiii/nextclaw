# v0.12.50-minimax-portal-oauth-provider

## 迭代完成说明（改了什么）
- 新增内置 provider：`minimax-portal`（单 provider 形态），目标是提供“浏览器 OAuth 授权、无需手填 API Key”的体验。
- 在 provider auth 机制中新增“多授权方法”能力：同一个 provider 可声明多个 method（本次为 `global` / `cn`）。
- 在 provider auth 机制中新增协议方言支持：
  - `rfc8628`（现有标准 device code，兼容 `qwen-portal`）。
  - `minimax_user_code`（适配 MiniMax 的 `user_code` 授权与 token 轮询响应格式）。
- UI Provider 配置页新增授权方法选择器（当 method>1 时展示），`start auth` 会携带 `methodId`。
- server `config/meta` 暴露 auth methods 与 defaultMethodId，前端可直接渲染。
- server 新增 provider override 机制（当前注入 `minimax-portal`），确保在当前依赖装配下可立即在 UI 中看到该 provider 并执行 OAuth。
- 新增/更新测试：
  - `config/meta` 包含 `minimax-portal` 与 `global/cn` 方法。
  - `minimax-portal` 走 `cn` method 时可完成授权并写入 token，`apiBase` 落为 `https://api.minimaxi.com/v1`。

## 测试/验证/验收方式
- 单测（server provider 路由）：
  - `pnpm -C packages/nextclaw-server test -- --run src/ui/router.provider-test.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
- 全量构建/校验（按项目规则）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟测试（真实 API 路径，隔离临时配置）：
  - 通过 `createUiRouter` 请求 `/api/config/meta`，确认返回中存在 `minimax-portal`，且 `auth.methods` 包含 `global,cn`。
  - 观察点：输出 `SMOKE_OK: minimax-portal methods=global,cn`。

## 发布/部署方式
- 本次为 server/ui/core/runtime 代码改动，不涉及数据库与后端 migration。
- 合并后按常规 CI 流程执行 `build/lint/tsc`。
- 若走 npm/版本发布，按项目既有 release 流程执行（changeset version/publish）。

## 用户/产品视角的验收步骤
1. 打开 NextClaw UI 的 `Providers` 页面，确认可看到 `MiniMax Portal`。
2. 进入 `MiniMax Portal` 配置卡，确认授权区可选择 `Global` / `China Mainland (CN)`。
3. 选择 `CN` 后点击“浏览器授权”，按页面提示完成 MiniMax 授权。
4. 返回 NextClaw，等待授权完成提示，确认 provider 状态变为已配置。
5. 检查 `apiBase` 自动为 `https://api.minimaxi.com/v1`（CN）或 `https://api.minimax.io/v1`（Global）。
6. 在对话页选择 `minimax-portal/*` 模型发送测试消息，确认模型可正常返回。
