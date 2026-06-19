# v0.20.94 Browser Tab Instance Title

## 迭代完成说明

本次让 NextClaw 浏览器 tab 标题携带当前实例标识，帮助多实例并行时快速辨认当前页面来源。

实现 owner 收敛在 `packages/nextclaw-ui/src/shared/lib/ui-document-title/index.ts`：

- 非 local 地址使用 `location.host`，例如 `nextclaw.example.com:8443`。
- `localhost`、`*.localhost`、`127.*`、`::1` 这类本地地址只显示端口，例如 `5173`。
- 标题保持产品化形态，例如 `NextClaw 5173 - Chat`，避免 `(:5173)` 这类视觉上不顺的 URL 残片。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui exec vitest run src/shared/lib/ui-document-title/__tests__/ui-document-title.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/shared/lib/ui-document-title/index.ts packages/nextclaw-ui/src/app/components/layout/app-layout.tsx packages/nextclaw-ui/src/shared/lib/ui-document-title/__tests__/ui-document-title.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`

本地浏览器冒烟：通过 in-app Browser 打开 `http://127.0.0.1:5188/chat`，实际 tab 标题为 `NextClaw 5188 - 对话`。

## 发布/部署方式

未发布。该用户可见 UI 改动已添加 changeset，等待后续统一 NPM 发布批次带出。

## 用户/产品视角的验收步骤

1. 在本地以 `localhost:<port>` 或 `127.0.0.1:<port>` 打开 NextClaw UI。
2. 浏览器 tab 标题应显示类似 `NextClaw 5173 - Chat`，只用端口区分本地实例。
3. 通过非 local 域名或局域网 IP 打开时，标题应显示完整 host，例如 `NextClaw nextclaw.example.com:8443 - AI Providers`。
4. 切换页面后，页面标题段继续随路由更新，实例标识保持稳定。

## 可维护性总结汇总

本次复用既有 `ui-document-title` owner，没有新增 manager/service/factory，也没有新增并行标题入口。新增逻辑是浏览器边界上的无状态解析，测试覆盖 local、loopback、remote 和缺少 location 的旧形态。

Maintainability guard 当前结果：无阻塞、无警告。该改动是新增用户可见能力，非测试代码净增长属于功能实现与 owner 测试所需。

## NPM 包发布记录

- 需要发布：是，用户可见 UI 行为变化。
- 影响包：`@nextclaw/ui`
- 发布状态：待统一发布。
