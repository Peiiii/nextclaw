# v0.17.7 Unified NPM Republish Including NextClaw

## 迭代完成说明（改了什么）

- 重新执行了一次统一 NPM 发布，这次明确把 `nextclaw` 本体一起纳入发布批次，而不是只发布前端 UI 相关包。
- 本次自动 release 识别到并实际发布的包：
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/ui`
  - `nextclaw`
- 根因已确认：
  - 上一轮重新发布只覆盖了 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui`，但在后续提交和前端构建产物更新后，`packages/nextclaw` 目录下已经存在新的 `ui-dist` 产物与包元数据变化，具备再次单独发布 `nextclaw` 的实际变化面。
  - 本次通过新的 release 批次重新扫描，`release-auto-changeset` 已明确识别 `packages/nextclaw/ui-dist`、`packages/nextclaw/package.json` 与 `packages/nextclaw/tsconfig.json` 为 `nextclaw` 待发布变更来源，说明这次命中的是发布边界遗漏，而不是重复空发。
- 本次未新增新的业务实现；主要目标是把最新已提交能力和 `nextclaw` 包内的前端构建产物正式发布到 NPM。

## 测试/验证/验收方式

- 已通过：`pnpm npm whoami`
  - 结果：当前发布账号为 `peiiii`。
- 已通过：`pnpm release:auto`
  - 自动识别结果：
    - `@nextclaw/agent-chat-ui`
    - `@nextclaw/ui`
    - `nextclaw`
  - `release:check` 通过，包含：
    - `@nextclaw/agent-chat-ui build`
    - `@nextclaw/agent-chat-ui tsc`
    - `@nextclaw/ui build`
    - `@nextclaw/ui tsc`
    - `nextclaw build`
    - `nextclaw tsc`
  - `changeset publish` 成功发布：
    - `@nextclaw/agent-chat-ui@0.3.12`
    - `@nextclaw/ui@0.12.17`
    - `nextclaw@0.18.8`
  - `release:verify:published` 最终结果：`published 3/3 package versions`
- 已通过：`pnpm view nextclaw version && pnpm view @nextclaw/agent-chat-ui version && pnpm view @nextclaw/ui version`
  - 发布后线上版本：
    - `nextclaw@0.18.8`
    - `@nextclaw/agent-chat-ui@0.3.12`
    - `@nextclaw/ui@0.12.17`

## 发布/部署方式

- 已执行统一发布命令：`pnpm release:auto`
- 发布链路包含：
  - 同步已发布 tag
  - 自动生成 release changeset
  - 版本抬升与 changelog 更新
  - 发布前 release check
  - `changeset publish`
  - 发布后 registry 可见性验证
- `nextclaw build` 阶段同步把最新 UI 构建产物复制到 `packages/nextclaw/ui-dist`。

## 用户/产品视角的验收步骤

1. 在 NPM registry 查看 `nextclaw`，确认最新版本为 `0.18.8`。
2. 在 NPM registry 查看 `@nextclaw/agent-chat-ui`，确认最新版本为 `0.3.12`。
3. 在 NPM registry 查看 `@nextclaw/ui`，确认最新版本为 `0.12.17`。
4. 升级 `nextclaw` 后，确认包内前端资源与最近一批聊天 UI / 代码块体验改动一致。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。继续沿用统一 `release:auto` 流程，没有人为拼装单包发布脚本。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有新增旁路发布逻辑，也没有手工 patch 版本号后直接 `npm publish`。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次主要新增 release 元数据与构建产物快照，不涉及新的业务复杂度增长。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。发布仍通过统一脚本收敛，`nextclaw` 的前端产物由现有 build 链路写入。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增一个独立 release 迭代目录，用于区分上一轮只发 UI 包的 `v0.17.5` 与这次把 `nextclaw` 也一并发出的批次。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次核心动作是 release 与构建产物更新，不是新的实现任务。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布哪些包：
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/ui`
  - `nextclaw`
- 每个包当前是否已经发布：
  - `@nextclaw/agent-chat-ui`：已发布，版本 `0.3.12`
  - `@nextclaw/ui`：已发布，版本 `0.12.17`
  - `nextclaw`：已发布，版本 `0.18.8`
- 阻塞或触发条件：无；本次发布链路已完整执行并完成线上校验。
