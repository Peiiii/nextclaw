# v0.0.7-qwen-cli-credential-import

## 迭代完成说明（改了什么）

1. 为 provider-auth 增加 CLI 凭证导入能力（数据驱动）
- 在 provider `auth` 元数据新增 `cliCredential` 描述（路径与字段映射）。
- `qwen-portal` 内置配置增加 `~/.qwen/oauth_creds.json` 导入定义。

2. 后端新增导入接口
- 新增 `POST /api/config/providers/:provider/auth/import-cli`。
- 按 provider 元数据读取 CLI 凭证并写入 `providers.<name>.apiKey`。
- 自动回填 provider 默认 `apiBase`（若当前为空）。

3. 前端接入导入交互
- Provider 配置卡在支持的 provider 上显示 `Import From Qwen CLI` 按钮。
- 导入成功后自动刷新配置，并展示状态信息。

4. 元数据透传
- `config/meta` 中 `provider.auth` 新增 `supportsCliImport`，前端按该字段决定是否展示导入入口。

## 测试/验证/验收方式

1. 自动化测试
- `packages/nextclaw-server/src/ui/router.provider-test.test.ts`
  - 校验 `qwen-portal` auth 元数据包含 `supportsCliImport=true`
  - 校验 `auth/import-cli` 可从 `~/.qwen/oauth_creds.json` 导入并生效
  - 校验 CLI 凭证文件缺失时返回 `AUTH_IMPORT_FAILED`
  - 校验 CLI 凭证过期时返回 `AUTH_IMPORT_FAILED`
  - 当前总计：`10 tests passed`

2. 构建与类型
- `pnpm -C packages/nextclaw-core build && pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-server build && pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui build && pnpm -C packages/nextclaw-ui tsc`
- 全仓完整验证通过：
  - `pnpm build`
  - `pnpm lint`（仅历史 max-lines warnings，无 errors）
  - `pnpm tsc`

3. Lint
- 定向 lint 本次改动文件；若全量 `nextclaw-ui lint` 失败，需标注为仓库历史问题并附失败文件。

## 发布/部署方式

1. 本次为 NextClaw 本地服务/UI改动
- 无需单独发布 Worker。
- 按常规 npm 发布流程发布受影响包（core/server/ui/nextclaw）。

2. 若仅本地验证
- 无需发布，直接 `pnpm dev` 后在 UI 完成验收。

## 用户/产品视角的验收步骤

1. 确保本机存在 `~/.qwen/oauth_creds.json`（Qwen CLI 已登录）。
2. 打开 NextClaw UI 的 Providers 页面，进入 `qwen-portal`。
3. 点击 `Import From Qwen CLI`。
4. 观察状态为导入成功，且 provider 显示已配置 API Key。
5. 选择 `qwen-portal/*` 模型发起对话，确认可正常请求。
