# v0.20.2 Panel App Tokenized Assets

## 迭代完成说明

本次修复目录式 Panel App 在远程 UI auth 下 CSS/JS 子资源加载失败的问题。

根因：

- 目录式 Panel App 的 HTML 通过已认证的 `/api/panel-apps/:id/content` 加载。
- HTML 内相对资源原先会被 `<base href="/api/panel-apps/:id/assets/">` 指向受 UI auth 保护的 assets route。
- sandbox iframe 内的 CSS/JS 子资源请求不会走宿主 SDK，也不能稳定附带宿主认证 header。
- 远程启用 UI auth 后 assets route 返回 401 JSON，浏览器按 CSS/JS 资源处理时被 ORB 阻断。

确认方式：

- 线上反馈中的 `app.js/styles.css` URL 实际返回 401 JSON。
- 本地代码确认 MIME 映射正确，失败点不在 content-type，而在资源路由认证边界。

修复方式：

- `PanelAppManager.getPanelAppContent()` 为目录式应用生成短期只读 asset token。
- 目录式 HTML 注入 `<base href="/api/panel-app-assets/<token>/">`。
- 新增 `GET /api/panel-app-assets/:token/*`，auth middleware 只对该窄路由放行。
- server controller 继续保持薄层，调用 `PanelAppManager.getPanelAppAssetByToken()`。
- kernel 的 `PanelAppAssetTokenService` 负责 HMAC token 签发、签名校验和过期校验。
- 既有 `/api/panel-apps/:id/assets/*` 保持受 UI auth 保护，用于宿主侧认证资源读取。

该修复命中根因，而不是把 iframe 改成 `allow-same-origin` 或公开整个 assets 目录。

## 测试/验证/验收方式

已执行：

```bash
pnpm --filter @nextclaw/kernel exec vitest run src/managers/__tests__/panel-app.manager.test.ts
pnpm --filter @nextclaw/server exec vitest run src/features/panel-apps/controllers/panel-apps.controller.test.ts src/app/router.auth.test.ts
pnpm --filter @nextclaw/kernel tsc
pnpm --filter @nextclaw/server tsc
pnpm --filter @nextclaw/kernel lint
pnpm --filter @nextclaw/server lint
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched-files>
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

验证结果：

- Kernel Panel App 定向测试通过：23 tests passed。
- Server Panel App / auth route 定向测试通过：20 tests passed。
- Kernel / Server TypeScript 检查通过。
- Kernel lint 通过。
- Server lint 通过，有 8 个既有 warning，均不在本次触达文件。
- Governance diff 检查通过。
- Governance backlog ratchet 通过。

## 发布/部署方式

已发布 NPM 正式版本。

发布方式：

```bash
pnpm release:report:health
pnpm release:auto
npm view nextclaw dist-tags --json
npm view nextclaw@latest version
npm view @nextclaw/kernel@latest version
npm view @nextclaw/server@latest version
```

发布结果：

- `nextclaw@0.20.1` 已发布到 `latest`。
- `@nextclaw/kernel@0.2.1` 已发布到 `latest`。
- `@nextclaw/server@0.13.1` 已发布到 `latest`。
- `release:verify:published` 确认本批次 `46/46` 个 package version 已发布。
- 已创建 release tags，包括 `nextclaw@0.20.1`、`@nextclaw/kernel@0.2.1`、`@nextclaw/server@0.13.1`。

真实安装 smoke：

```bash
npm install --prefix /tmp/nextclaw-npm-smoke-9HdPyx nextclaw@0.20.1
NEXTCLAW_HOME=/tmp/nextclaw-npm-home-oIO0SV /tmp/nextclaw-npm-smoke-9HdPyx/node_modules/.bin/nextclaw --version
NEXTCLAW_HOME=/tmp/nextclaw-npm-home-oIO0SV /tmp/nextclaw-npm-smoke-9HdPyx/node_modules/.bin/nextclaw update --check
```

结果：

- `nextclaw --version` 输出 `0.20.1`。
- `nextclaw update --check` 输出当前 npm launcher/runtime 已是 `0.20.1`，无需更新。

## 用户/产品视角的验收步骤

建议验收：

1. 在启用 UI auth 的远程 NextClaw 中打开一个目录式 Panel App。
2. Panel App 使用相对路径引用 `styles.css` 与 `app.js`。
3. Network 中 `/api/panel-app-assets/<token>/styles.css` 返回 `200 text/css`。
4. Network 中 `/api/panel-app-assets/<token>/app.js` 返回 `200 application/javascript`。
5. 页面样式生效，脚本执行，不再出现 ORB 阻断。
6. 未认证访问 `/api/panel-apps/:id/assets/*` 仍返回 401。
7. iframe sandbox 仍不包含 `allow-same-origin`。

## 可维护性总结汇总

本次遵守的维护性原则：

- Server 保持薄层，只做 HTTP 路由、auth middleware 窄放行和 response。
- Kernel 的 `PanelAppManager` 继续作为 Panel App 领域 owner，统一拥有 content、asset 与 tokenized asset 语义。
- `PanelAppSourceService` 仍只负责 source/manifest/asset 文件读取，不感知 token 或 HTTP。
- 新增 `PanelAppAssetTokenService` 是有状态、有权限边界的真实 service，不是空心 wrapper。
- 没有打开 `allow-same-origin`，没有公开旧 assets 路由，没有新增兼容 fallback。

维护性检查结果：

- maintainability guard 无 error。
- warnings：
  - `panel-app.manager.ts` 接近 500 行预算。
  - `panel-app.manager.test.ts` 接近测试文件预算。
  - `packages/nextclaw-server/src/app` 目录仍有既有目录数量债务。

这些 warning 未阻塞本次修复，但后续 Panel App 继续演进时，应优先拆出 Panel App content/asset 子 owner 或测试分文件，避免 `PanelAppManager` 继续接近红线。

## NPM 包发布记录

已发布。

本次 `pnpm release:auto` 生成完整 public workspace patch release batch，并发布 `46` 个包，核心用户路径版本为：

- `nextclaw@0.20.1`
- `@nextclaw/kernel@0.2.1`
- `@nextclaw/server@0.13.1`

NPM dist-tag：

```json
{
  "beta": "0.19.31-beta.7",
  "latest": "0.20.1"
}
```
