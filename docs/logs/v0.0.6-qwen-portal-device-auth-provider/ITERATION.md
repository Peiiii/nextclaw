# v0.0.6-qwen-portal-device-auth-provider

## 迭代完成说明（改了什么）

1. Provider 架构延续数据驱动
- 在 Provider 元数据中新增 `auth` 能力描述（当前支持 `device_code`）。
- 新增内置 `qwen-portal` Provider：
  - `defaultApiBase: https://portal.qwen.ai/v1`
  - 默认模型：`qwen-portal/coder-model`、`qwen-portal/vision-model`
  - 授权方式：`chat.qwen.ai` device-code + PKCE。

2. UI Server 接入通用授权链路
- 新增 Provider Auth 执行模块：`packages/nextclaw-server/src/ui/provider-auth.ts`
- 新增 API：
  - `POST /api/config/providers/:provider/auth/start`
  - `POST /api/config/providers/:provider/auth/poll`
- 授权成功后自动写入 `providers.<name>.apiKey`，并按需补齐 `apiBase`。

3. 前端接入授权交互
- Provider 配置页新增“浏览器授权”入口（仅对支持 `device_code` 的 provider 显示）。
- 前端授权轮询成功后自动刷新配置数据。

4. 方案目标达成情况
- 保持“登录非强制”：未登录仍可使用其它 provider（含内置 NextClaw）。
- `qwen-portal` 以普通 provider 形态接入，满足“通用化 + 解耦”目标。

## 测试/验证/验收方式

1. 代码验证
- `pnpm -C packages/nextclaw-core build && pnpm -C packages/nextclaw-server build && pnpm -C packages/nextclaw-ui build`
- `pnpm -C packages/nextclaw-core tsc && pnpm -C packages/nextclaw-server tsc && pnpm -C packages/nextclaw-ui tsc`
- 定向 lint（本次改动文件）通过，历史超长文件规则仅警告。

2. 自动化测试
- 新增/更新 `packages/nextclaw-server/src/ui/router.provider-test.test.ts`：
  - 校验 `qwen-portal` 元数据包含 `auth.kind=device_code`
  - 校验 `auth/start + auth/poll` 成功后写入 provider key 与默认 apiBase。

## 发布/部署方式

1. 本次为本地服务与 UI 功能改动
- 无需单独 Worker 发布。
- 按常规包发布流程发版受影响包（core/server/ui/nextclaw）。

2. 若联动发布 CLI
- 保持依赖版本一致后执行统一发布。

## 用户/产品视角的验收步骤

1. 打开 UI 的 Providers 页面，选择 `qwen-portal`。
2. 点击“Authorize in Browser”，在浏览器完成 Qwen 授权。
3. 返回 UI，等待状态变为授权成功。
4. 在模型选择中使用 `qwen-portal/*` 模型发起对话。
5. 验证未授权其它 provider 不受影响，产品仍可正常使用。
