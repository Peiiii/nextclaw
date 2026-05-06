# v0.17.23-user-facing-docs-ia-redesign

## 迭代完成说明

- 本次把 `apps/docs` 从“页面和导航逐步补丁堆叠”的状态，重写为更接近成熟开源/开发者产品文档的结构：用户先跑通，再按任务深入，日常使用进入手册，低频查询进入参考，项目信息后置。
- 中英文公开站最终收敛为 `Get Started / Guides / Manuals / Reference / Project` 五个主模块：
  - `Get Started / 开始`：解释 NextClaw 是什么、如何完成最小安装、安装后下一步做什么。
  - `Guides / 指南`：承接用户要完成的典型任务，例如选择模型、连接通道、配置定时任务、自动启动、远程访问、Docker 一键运行与场景教程。
  - `Manuals / 手册`：承接稳定机制说明，例如配置、运行时托管、聊天会话、密钥、资源管理。
  - `Reference / 参考`：承接低频查询内容，例如故障排查、核心命令、完整命令索引、高级主题、多 Agent。
  - `Project / 项目`：承接 Project Pulse、愿景、路线图、更新笔记、社区等项目信息，避免它们占据用户上手主路径。
- 本次不是只改导航结构，而是同步重写了中英文首页、开始路径、指南、手册、参考、场景教程与遗留入口说明，让页面职责和内容口径与新结构一致。
- 完整命令索引被保留为查询型 `Reference` 内容，而不是塞进用户入门流程；用户主路径只暴露安装、启动、重启、验证等高频必要动作。
- `tools`、`sessions` 等旧入口降级为兼容/解释型页面，不再作为前排用户概念；项目脉搏、愿景、路线图继续留在 `Project` 信息层。
- 方案文档 [2026-05-06-world-class-user-docs-system-design.md](../../plans/2026-05-06-world-class-user-docs-system-design.md) 已更新为本次实际落地的结构、页面职责和内容边界。

根因不是单个页面缺内容，而是用户主路径、任务教程、机制手册、查询参考、项目信息长期混在同一层级。  
这次改动直接修正信息架构与内容职责层的根因，避免继续用局部补丁堆文档。

## 测试/验证/验收方式

- 已通过：`./node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc apps/docs/.vitepress/config.ts --noEmit --module esnext --target es2022 --moduleResolution bundler --allowSyntheticDefaultImports --skipLibCheck`
  - 目的：对本次触达的 VitePress TypeScript 配置入口做定向类型检查。
- 已通过：`PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
  - 结果：VitePress 构建完成，中英文新导航与重写后的文档页全部可渲染。
  - 备注：仅出现既有 chunk size warning，不阻塞发布。
- maintainability guard：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/docs/.vitepress/config.ts apps/docs/zh apps/docs/en`
  - 结果：`Maintainability check not applicable: no changed code-like files found.`
  - 原因：本次为文档内容与文档站配置改动，没有新增受该脚本识别的代码型文件集合。
- `pnpm lint:new-code:governance`：未通过
  - 原因：当前工作区存在与本次文档重写无关的 `scripts/governance/module-structure/lint-new-code-module-structure.mjs` 改动，其中 `collectMissingWorkspaceConfigFindings` 命中参数 mutation 规则。
  - 说明：该文件不属于本次文档改动提交范围，本次未修改也未提交。
- `pnpm check:governance-backlog-ratchet`：未通过
  - 原因：仓库当前已有历史 `docFileNameViolations` 为 `13`，高于基线文件中的 `11`。
  - 说明：这是预存治理基线漂移，不是本次文档重写新引入的问题；本次未修改基线，也未扩大治理例外。

运行时冒烟：不适用，本次未改产品运行逻辑。

## 发布/部署方式

- 已执行：`PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`
- 部署结果：成功
- Cloudflare Pages 预览地址：
  - `https://66950cdf.nextclaw-docs.pages.dev`

本次发布只涉及文档站部署，不涉及后端、数据库、NPM 包或桌面发布闭环。

## 用户/产品视角的验收步骤

1. 打开中文首页，确认入口优先回答“NextClaw 是什么、怎么跑起来、下一步做什么”，而不是先展示项目新闻或命令大全。
2. 打开中文导航，确认主结构为 `开始 / 指南 / 手册 / 参考 / 项目`。
3. 打开英文导航，确认主结构同构为 `Get Started / Guides / Manuals / Reference / Project`。
4. 进入 `Guides / 指南`，确认内容围绕用户任务组织，例如模型、通道、定时、自动启动、远程访问和典型教程。
5. 进入 `Manuals / 手册`，确认内容围绕稳定机制组织，例如配置、运行时、聊天、密钥、资源。
6. 进入 `Reference / 参考`，确认完整命令索引存在，但不再要求入门用户先读。
7. 进入 `Project / 项目`，确认 Project Pulse、愿景、路线图、更新笔记、社区等内容被后置为项目信息层。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否遵循“用户主路径优先、任务指南与机制手册分离、完整索引旁路承载、项目信息后置”的原则：是。
- 是否减少了文档站的角色冲突：是。过去 `guide` 同时承接上手、完整参考、项目脉搏的混杂状态已被收口。
- 是否清晰区分了用户文档站、命令索引、`USAGE.md` 真相源与内部方案文档：是。
- 是否需要 `post-edit-maintainability-review`：不适用。此次没有业务源码、脚本、测试或运行链路代码改动。
- 目录与命名是否更可预测：是。用户可读主路径与低频参考层已经分离，后续扩展新教程、手册页或参考页有明确落点。

## NPM 包发布记录

不涉及 NPM 包发布。
