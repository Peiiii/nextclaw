# v0.17.23-user-facing-docs-ia-redesign

## 迭代完成说明

- 本次把 `apps/docs` 从“页面逐步补丁堆叠”的状态，重构成更接近世界级产品文档的结构：用户主路径优先、完整命令索引旁路承载、项目信息层后置。
- 中英文导航同时重排：
  - 新增显式的 `认识 NextClaw / Understand NextClaw`
  - 把 `开始使用 / Get Started` 与 `接入与配置 / Connect & Configure` 分开
  - 把 `使用 NextClaw / Use NextClaw` 与 `运行与托管 / Run & Host` 分开
  - 保留 `参考与排错 / Reference & Troubleshooting` 作为查询层
  - 新增独立的 `项目与生态背景 / Project & Ecosystem` 信息层
- 首页入口同步改写，不再把 `Project Pulse` 这种尾部信息放在用户前排动作里，而是优先引导到 `快速开始 / Runtime & Hosting / Product Notes`。
- 新增中英文 `apps/docs/{zh,en}/project/*` 结构，正式承接：
  - `Project Pulse`
  - `Vision`
  - `Roadmap`
  - `Release Notes`
  - `Community`
- 原来位于 `guide` 下的 `project-pulse.md`、`vision.md`、`roadmap.md` 收口为迁移页，避免旧链接直接失效，同时把 canonical 路径切到新的 `project` 层级。
- `notes`、`blog`、`project` 三类公开信息层关系被重新对齐：`project` 承担总入口，`notes` 承担短更新，`blog` 承担长文判断。
- 方案文档 [2026-05-06-world-class-user-docs-system-design.md](../../plans/2026-05-06-world-class-user-docs-system-design.md) 已补齐，并明确了目录结构、模块排序原则、页面类型合同与真相源边界。

根因不是单个页面少了几段文案，而是用户主路径、查询型参考、AI/CLI 真相源、项目信息层长期没有被系统性分开。  
这次改动直接修的是信息架构和页面职责层的根因，而不是继续局部补丁。

## 测试/验证/验收方式

- 已通过：`./node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc apps/docs/.vitepress/config.ts --noEmit --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --skipLibCheck`
  - 目的：对本次触达的 TypeScript 配置入口做定向类型检查
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm lint:new-code:governance`
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
  - 结果：VitePress 构建完成，新增项目层页面、导航和迁移页全部可渲染
  - 备注：仅出现既有 chunk size warning，不阻塞发布
- maintainability guard：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：`not applicable`
  - 原因：本次主改动为文档页和 VitePress 配置，没有新增受该脚本识别的代码型文件集合
- `pnpm check:governance-backlog-ratchet`：未通过
  - 原因：仓库当前已存在的历史 `docFileNameViolations` 为 `13`，高于基线文件中的 `11`
  - 说明：这是预存治理基线漂移，不是本次文档 IA 重构新引入的问题；本次未修改基线，也未借机扩大治理例外

运行时冒烟：不适用，本次未改产品运行逻辑。

## 发布/部署方式

- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`
- 部署结果：成功
- Cloudflare Pages 预览地址：
  - `https://6c46374d.nextclaw-docs.pages.dev`

本次发布只涉及文档站部署，不涉及后端、数据库、NPM 包或桌面发布闭环。

## 用户/产品视角的验收步骤

1. 打开中文首页，确认前排动作优先指向：
   - `快速开始`
   - `运行与托管`
   - `更新笔记`
2. 打开中文侧边栏，确认主路径顺序更接近：
   - `认识 NextClaw`
   - `开始使用`
   - `接入与配置`
   - `使用 NextClaw`
   - `运行与托管`
3. 打开 [项目总览](/zh/project/)，确认 `Project Pulse`、`愿景`、`路线图`、`更新笔记`、`社区` 已经从 `guide` 主路径剥离成独立信息层。
4. 访问旧路径：
   - `/zh/guide/project-pulse`
   - `/zh/guide/vision`
   - `/zh/guide/roadmap`
   确认它们不再承担主内容，而是把用户引导到新的 canonical `project` 路径。
5. 打开英文对应页面，确认结构同构：
   - `/en/project/`
   - `/en/project/project-pulse`
   - `/en/project/vision`
   - `/en/project/roadmap`
   - `/en/project/release-notes`

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否遵循“用户主路径最小暴露、完整索引旁路承载、项目信息层后置”的原则：是。
- 是否减少了文档站的角色冲突：是。过去 `guide` 同时承接上手、完整参考、项目脉搏的混杂状态已被收口。
- 是否清晰区分了用户文档站、命令索引、`USAGE.md` 真相源与内部方案文档：是。
- 是否需要 `post-edit-maintainability-review`：不适用。此次没有业务源码、脚本、测试或运行链路代码改动。
- 目录与命名是否更可预测：是。新增 `project/` 层后，项目信息不再继续侵入 `guide/`。

## NPM 包发布记录

不涉及 NPM 包发布。
