# v0.16.76-nextclaw-apps-ecosystem-closure

## 迭代完成说明

本次迭代把 `NextClaw Apps` 从“本地可跑的 runtime 原型”推进成了一个真实可分发、可发现、可安装、可发布的产品闭环，形成了下面这条已经跑通的主路径：

`开发 app -> napp publish -> apps registry 收录 -> apps web 展示 -> napp install -> grant -> run`

本次实际落地的核心交付：

- 在 `packages/nextclaw-app-runtime` 补齐 `napp publish`，默认直连官方 Apps API 与官方 registry。
- 在 `packages/nextclaw-app-runtime` 的 `napp create` 中补齐 `marketplace.json` 与 `README.md`，让新 app 从第一步就满足发布合同。
- 新增独立 SDK 包 `packages/nextclaw-app-sdk`，为 app UI 提供稳定 bridge client，不要求开发者手写 `fetch("/__napp/...")`。
- 在 `workers/marketplace-api` 中新增 apps 域，补齐列表、详情、文件查看、README 读取、bundle 下载、registry metadata 与 publish API。
- 在 `workers/marketplace-api` 中为 apps 新增独立数据结构与持久化链路，避免把 app 发布逻辑继续塞进原有 marketplace 主流程里。
- 新增独立 web 应用 `apps/nextclaw-apps-web`，作为公开的 Apps 展示入口。
- 补齐 3 个官方示例 app：`hello-notes`、`workspace-glance`、`starter-card`。
- 将官方 apps registry 默认地址冻结为 `https://apps-registry.nextclaw.io/api/v1/apps/registry/`。
- 将人类入口冻结为 `https://apps.nextclaw.io`，当前已完成 Pages 部署，域名绑定由用户接手处理。
- 已将 3 个官方示例 app 真正发布到线上 registry。
- 已将 `@nextclaw/app-runtime@0.4.0` 与 `@nextclaw/app-sdk@0.1.0` 真正发布到 npm。
- 已将官方 marketplace skill `@nextclaw/nextclaw-app-runtime` 更新到与当前 Apps 闭环一致的版本，补齐 `publish / install / registry / store` 新工作流描述。

相关设计文档：

- [NextClaw Apps 第二阶段 PRD（冻结稿）](../../../plans/2026-04-19-nextclaw-apps-ecosystem-and-marketplace-design.md)

## 测试/验证/验收方式

本次实际执行并通过的验证：

- `pnpm -C packages/nextclaw-app-runtime test`
- `pnpm -C packages/nextclaw-app-runtime build`
- `pnpm -C packages/nextclaw-app-runtime lint`
- `pnpm -C packages/nextclaw-app-runtime smoke`
- `pnpm -C packages/nextclaw-app-sdk test`
- `pnpm -C packages/nextclaw-app-sdk build`
- `pnpm -C packages/nextclaw-app-sdk tsc`
- `pnpm -C packages/nextclaw-app-sdk lint`
- `pnpm -C apps/nextclaw-apps-web build`
- `pnpm -C apps/nextclaw-apps-web tsc`
- `pnpm -C apps/nextclaw-apps-web lint`
- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/marketplace-api lint`
- `curl -sS https://apps-registry.nextclaw.io/health`
- `curl -sS https://apps-registry.nextclaw.io/api/v1/apps/items`
- `curl -sS https://apps-registry.nextclaw.io/api/v1/apps/items/hello-notes`
- `curl -sS https://apps-registry.nextclaw.io/api/v1/apps/registry/nextclaw.hello-notes`
- `curl -sS https://apps-registry.nextclaw.io/api/v1/apps/items/hello-notes/files`
- `curl -sS "https://apps-registry.nextclaw.io/api/v1/apps/items/hello-notes/files/blob?path=README.md"`
- `curl -sS https://nextclaw-apps.pages.dev`
- `pnpm dlx wrangler pages deploy apps/nextclaw-apps-web/dist --project-name nextclaw-apps --branch master --commit-dirty=true`
- `pnpm -C workers/marketplace-api db:migrate:skills:remote`
- `pnpm -C workers/marketplace-api run deploy`
- `node packages/nextclaw-app-runtime/dist/main.js publish apps/examples/hello-notes --api-base https://apps-registry.nextclaw.io --token "$NEXTCLAW_MARKETPLACE_ADMIN_TOKEN" --json`
- `node packages/nextclaw-app-runtime/dist/main.js publish apps/examples/workspace-glance --api-base https://apps-registry.nextclaw.io --token "$NEXTCLAW_MARKETPLACE_ADMIN_TOKEN" --json`
- `node packages/nextclaw-app-runtime/dist/main.js publish apps/examples/starter-card --api-base https://apps-registry.nextclaw.io --token "$NEXTCLAW_MARKETPLACE_ADMIN_TOKEN" --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js install nextclaw.hello-notes --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js list --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js info nextclaw.hello-notes --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js permissions nextclaw.hello-notes --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js grant nextclaw.hello-notes --document notes=/tmp/... --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js run nextclaw.hello-notes --host 127.0.0.1 --port 3412 --json`
- `curl -sS -X POST http://127.0.0.1:3412/__napp/run -H 'content-type: application/json' --data '{"action":"summarizeNotes"}'`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js revoke nextclaw.hello-notes --document notes --json`
- `NEXTCLAW_APP_HOME="$(mktemp -d ...)" node packages/nextclaw-app-runtime/dist/main.js uninstall nextclaw.hello-notes --json`
- `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw-app-runtime` 目录）
- `pnpm publish --access public --no-git-checks`（在 `packages/nextclaw-app-sdk` 目录）
- `npm view @nextclaw/app-runtime version`
- `npm view @nextclaw/app-sdk version`
- `python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/nextclaw-app-runtime`
- `node packages/nextclaw/dist/cli/index.js skills update skills/nextclaw-app-runtime --meta skills/nextclaw-app-runtime/marketplace.json --api-base https://marketplace-api.nextclaw.io`
- `curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fnextclaw-app-runtime`
- `tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-skill.XXXXXX) && node packages/nextclaw/dist/cli/index.js skills install @nextclaw/nextclaw-app-runtime --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- `pnpm check:governance-backlog-ratchet`

关键观察点：

- registry 线上健康检查返回 `ok=true`，并明确包含 `apps` 数据域。
- registry 列表、详情、registry metadata、文件列表与 README 文件读取均可用。
- 线上已经存在 3 个官方 app：`nextclaw.hello-notes`、`nextclaw.workspace-glance`、`nextclaw.starter-card`。
- Pages 已生成可访问部署：`https://nextclaw-apps.pages.dev` 与本次生产部署 `https://d911cd6e.nextclaw-apps.pages.dev`。
- 真实远端安装链路可用：`install -> list -> info -> permissions -> grant -> run -> revoke -> uninstall`。
- `hello-notes` 的真实运行调用返回 `output=129`，证明 Wasm 执行链路与授权目录读取链路都成立。
- npm 查询结果已确认 `@nextclaw/app-runtime=0.4.0`、`@nextclaw/app-sdk=0.1.0`。
- 官方 skill 已完成远端更新，`updatedAt` 已刷新，且临时目录安装冒烟拉到的是新版 `SKILL.md`。
- 仓库级 `pnpm lint:new-code:governance` 当前失败，但失败点来自工作区内 4 个与本轮 apps 无关的既有改动文件命名，不是本轮 apps 交付造成的阻塞。

## 发布/部署方式

本次实际发布与部署结果：

- Worker 已部署到：
  - `https://marketplace-api.nextclaw.io`
  - `https://apps-registry.nextclaw.io`
- 本次 worker deploy version id：
  - `edeb96e3-f417-4d20-a2ca-788c1f307359`
- Apps web 已部署到：
  - `https://nextclaw-apps.pages.dev`
  - `https://d911cd6e.nextclaw-apps.pages.dev`
- 目标正式域名：
  - `https://apps.nextclaw.io`
  - 当前状态：Pages 项目已部署，域名绑定由用户接手处理

本地开发者发布 app 的方式：

```bash
napp inspect ./apps/examples/hello-notes
napp publish ./apps/examples/hello-notes
```

本地用户安装官方 app 的方式：

```bash
napp install nextclaw.hello-notes
napp grant nextclaw.hello-notes --document notes=/absolute/path/to/notes
napp run nextclaw.hello-notes
```

如需切回默认 registry：

```bash
napp registry reset
```

## 用户/产品视角的验收步骤

1. 打开 `https://nextclaw-apps.pages.dev`，确认首页能正常加载。
2. 打开 registry 列表接口，确认能看到 3 个官方 app。
3. 打开 `hello-notes` 详情接口，确认能看到名称、版本、权限、README 与安装命令。
4. 在本机全局安装 `@nextclaw/app-runtime`：
   - `npm install -g @nextclaw/app-runtime`
5. 运行：
   - `napp install nextclaw.hello-notes`
6. 运行：
   - `napp permissions nextclaw.hello-notes`
7. 运行：
   - `napp grant nextclaw.hello-notes --document notes=/your/notes/path`
8. 运行：
   - `napp run nextclaw.hello-notes`
9. 打开命令输出的本地 URL。
10. 在 app UI 中触发运行，确认 app 能返回目录摘要结果。
11. 如需卸载，运行：
   - `napp uninstall nextclaw.hello-notes`

如果以上步骤成立，说明 `NextClaw Apps` 的“官方发布 -> 官方展示 -> 用户安装 -> 用户授权 -> 本地运行”闭环已经成立。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是

长期目标对齐 / 可维护性推进：

- 这次顺着 NextClaw “统一入口 + 生态能力编排”的长期方向推进了一步，因为 app 已经不再只是本地原型，而是一个真实可传播的生态形态。
- 这次仍然坚持“独立包、独立 worker、独立 web”的边界，没有把 apps 直接耦进现有主产品 UI 或主产品服务链路。
- 这次的新增能力集中在最小闭环上：runtime、publish、registry、web 展示、SDK、示例 app，没有扩散成评论、审核、评分、在线运行等额外系统。

代码增减报告：

- 新增：2531 行
- 删除：22 行
- 净增：+2509 行

非测试代码增减报告：

- 新增：2291 行
- 删除：22 行
- 净增：+2269 行

可维护性总结：

- 这次属于新增用户能力，非测试代码净增为正是合理的，但增长被收敛在最小必要范围内，没有把复杂度继续压回主产品代码。
- 本轮没有发现阻塞性的可维护性问题；当前仅有 4 个观察点：`packages/nextclaw-app-runtime/scripts/smoke.mjs` 接近预算、`packages/nextclaw-app-runtime/src/commands` 目录历史上已偏平、`workers/marketplace-api/src/infrastructure/apps/d1-marketplace-app.repository.ts` 接近预算、`workers/marketplace-api/src/main.ts` 接近预算。
- 抽象边界相对清晰：runtime 负责本地安装与运行，SDK 负责 UI bridge client，worker 负责 registry/publish，web 负责公开展示，没有再引入一层新的假角色目录。
- 仓库级治理失败的唯一阻塞来自工作区内无关文件命名，不属于本轮 apps 实现；因此本轮可维护性判断应基于 scoped guard 和本轮真实改动，而不是被无关脏改动污染。

## NPM 包发布记录

- 本次需要发包：是
- 本次发布的包：
  - `@nextclaw/app-runtime@0.4.0`：已发布，`npm view` 已确认可见
  - `@nextclaw/app-sdk@0.1.0`：已发布，`npm view` 已确认可见
- 本次无需待统一发布的包：无
- 额外说明：
  - `apps/nextclaw-apps-web` 为 Pages web 应用，不涉及 NPM 发包
  - `workers/marketplace-api` 为 Worker 部署，不涉及 NPM 发包
