# v0.19.50 Folder Panel Apps

## 迭代完成说明

本次迭代为 Panel Apps 增加目录式静态应用形态，同时保留既有 `.panel.html` 单文件形态。

完成内容：

- 新增 `*.panel/panel-app.json + index.html + assets` 的目录式 Panel App 发现和打开链路。
- 新增目录应用静态资源接口 `GET /api/panel-apps/:id/assets/*path`。
- 目录应用入口 HTML 会注入 Panel App bridge，并注入 `<base>` 以支持相对 CSS、JS、图片资源。
- 目录应用 manifest 支持 `id/title/description/icon/entry/capabilities/actions`，并要求 `id` 与目录名一致。
- 缺少 `panel-app.json` 的 `.panel` 目录不会被识别为 Panel App；非法 manifest 会返回明确错误。
- 删除目录应用时递归删除目录，并清理 launcher 状态、授权状态和 bridge session。
- 内置 `panel-app-creator` skill 已补充单文件/目录式应用选择规则和示例。
- Agent capability 声明错误时会返回可操作错误信息，提示已声明值、合法值和常见冒号写法。
- Panel App bridge session 改为 iframe 加载实例级缓存；刷新 iframe 后会重新创建 bridge session 并重读当前 manifest/HTML 声明。

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/panel-app.manager.test.ts`
- `pnpm -C packages/nextclaw-server test -- src/features/panel-apps/controllers/panel-apps.controller.test.ts`
- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-client-sdk tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm exec eslint <touched ts files>`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`

验收覆盖：

- 单文件 Panel App 兼容。
- 目录式 Panel App 发现、manifest 读取、入口 HTML 读取。
- 目录式资源读取和路径穿越拒绝。
- 相对 icon 转换为 Panel App assets URL。
- 缺失 manifest 目录跳过。
- 非法 manifest 明确报错。
- 删除目录应用并清理状态。
- server assets route 返回原始资源内容而不是 JSON envelope。
- 错误声明 `agent.generateObject` 时，系统拒绝调用并提示应使用 `agent:generateObject`。
- 同一个 iframe 实例内 bridge 调用复用同一个 session；iframe reload version 变化后会创建新 session，避免旧 capability 声明快照卡住。

## 发布/部署方式

已执行整体 NPM 正式发布：

- `pnpm changeset pre exit`
- `pnpm release:version`
- `pnpm release:publish`
- `pnpm release:verify:published`
- `npm view nextclaw dist-tags --json`

发布结果：`nextclaw@0.19.31` 已发布到 `latest`，完整 public workspace batch 共 46 个包已发布并通过 registry 验证。

发布后真实安装冒烟：

- 临时目录执行 `npm install --prefix <tmp> nextclaw@latest`。
- `nextclaw --version` 返回 `0.19.31`。
- 已确认安装包包含 `resources/update-bundle-public.pem`、`dist/cli/launcher/index.js`、`dist/cli/app/index.js`。
- 在隔离 `NEXTCLAW_HOME` 且未设置 update public key 环境变量时，`nextclaw update --check` 返回 runtime 已是最新。

## 用户/产品视角的验收步骤

1. 在 NextClaw workspace 的 `panels/` 下放置一个 `demo.panel/` 目录。
2. 在目录内创建 `panel-app.json`、`index.html`、`styles.css` 和 `app.js`。
3. 在右侧“应用 / 面板应用”列表中刷新，确认应用出现，并显示 manifest 标题、描述和图标。
4. 打开应用，确认 iframe 中页面正常加载，CSS/JS 生效。
5. 删除该目录式应用，确认列表状态和授权状态被清理。

## 可维护性总结汇总

本次是新增用户能力，生产代码净增长是必要的。

可维护性动作：

- `PanelAppManager` 仍是唯一业务 owner。
- 文件系统 source 发现、manifest 读取、assets 读取收敛到 `PanelAppSourceService`，避免 manager 继续膨胀。
- 路径解析、ID 编码、icon URL、content type 等无状态逻辑放在 `panel-app-source.utils.ts`。
- server 只新增薄 route，不读取 workspace 文件系统。

维护性检查结果：

- maintainability guard 通过，警告为测试文件增长、`PanelAppManager` 接近预算、server app 目录既有超预算。
- `PanelAppManager` 从 496 行降到 453 行。
- 没有新增目录治理错误。

## NPM 包发布记录

已发布整体 public workspace stable batch：

- `nextclaw@0.19.31`
- `@nextclaw/ui@0.12.35`
- `@nextclaw/core@0.12.25`
- `@nextclaw/kernel@0.1.15`
- `@nextclaw/server@0.12.26`
- `@nextclaw/service@0.1.18`
- `@nextclaw/shared@0.1.12`
- `@nextclaw/client-sdk@0.1.14`
- `@nextclaw/runtime@0.2.57`
- `@nextclaw/remote@0.1.103`
- 以及本次 changeset batch 内其余 public workspace packages，共 46 个包。

Registry 验证：

- `pnpm release:verify:published`：46/46 package versions published。
- `npm view nextclaw dist-tags --json`：`latest` 指向 `0.19.31`，`beta` 保持 `0.19.31-beta.7`。
