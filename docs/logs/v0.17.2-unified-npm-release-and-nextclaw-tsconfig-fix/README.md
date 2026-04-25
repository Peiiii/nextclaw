# v0.17.2-unified-npm-release-and-nextclaw-tsconfig-fix

## 迭代完成说明（改了什么）

- 响应“最近更新了一些东西，但是没有发布 NPM”的统一发包请求，执行了仓库标准自动 release 流程：`pnpm release:auto`，随后在 release check 失败后修复阻塞并续跑 `pnpm release:publish`。
- 根因已确认：
  - 首次 `release:auto` 在 `nextclaw` 包的 `tsc` 阶段失败。
  - 失败根因不是 npm 认证或 changeset，而是 [packages/nextclaw/tsconfig.json](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw/tsconfig.json) 里的内部路径映射仍指向不存在的 `../extensions/nextclaw-ncp-runtime-http-client`、`../extensions/nextclaw-ncp-runtime-stdio-client`，并且缺少 `@nextclaw/nextclaw-hermes-acp-bridge` 的 path 映射。
  - 这个根因通过 release check 的真实报错和仓库实际目录对比确认：相关包真实位于 `packages/nextclaw-ncp-runtime-http-client`、`packages/nextclaw-ncp-runtime-stdio-client`、`packages/nextclaw-hermes-acp-bridge`。
- 修复方式：
  - 更正 `nextclaw` 包 tsconfig 内部包 path 映射到真实目录。
  - 补上 `@nextclaw/nextclaw-hermes-acp-bridge` 的 path 映射。
  - 在不重置整批 release 状态的前提下，复用仓库的 release checkpoint 续跑 `pnpm release:publish`，完成统一发包。

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw tsc`
  - 结果：修复 path 映射后，`nextclaw` 单包类型检查通过。
- 已通过：`pnpm release:publish`
  - 结果：release check 恢复成功，`changeset publish`、`release:verify:published`、`changeset tag` 全部完成。
- 已通过：`pnpm view nextclaw version && pnpm view @nextclaw/agent-chat-ui version && pnpm view @nextclaw/ui version`
  - 结果：registry 返回 `0.18.7`、`0.3.10`、`0.12.15`。
- 已通过：release 自动流程中的 registry 验证
  - 结果：`[release:verify:published] published 3/3 package versions.`

## 发布/部署方式

- 本次按仓库标准 npm release 流程执行：
  1. `pnpm release:auto`
  2. 首次失败后修复 `packages/nextclaw/tsconfig.json`
  3. `pnpm -C packages/nextclaw tsc`
  4. `pnpm release:publish`
- 本次只涉及 npm registry 发包与本地 git tag 生成，不涉及站点部署、worker 部署或桌面安装包发布。

## 用户/产品视角的验收步骤

1. 在 npm registry 查询 `nextclaw`、`@nextclaw/agent-chat-ui`、`@nextclaw/ui` 的最新版本。
2. 确认分别为 `0.18.7`、`0.3.10`、`0.12.15`。
3. 以新版本安装 `nextclaw` 或依赖 `@nextclaw/ui` / `@nextclaw/agent-chat-ui` 的下游项目，确认可以解析到本轮发布版本。
4. 如需核对本地 release 收尾，确认本地已生成对应 tag：`nextclaw@0.18.7`、`@nextclaw/agent-chat-ui@0.3.10`、`@nextclaw/ui@0.12.15`。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有增加新的 release 分支或 fallback；只是把错误 path 改回真实目录，并补齐缺失映射。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。真实手写修复只落在一个 tsconfig 文件；`git diff --numstat -- packages/nextclaw/tsconfig.json` 为新增 `5` 行、删除 `2` 行，净增 `+3` 行，这 `+3` 行都用于把 release 阻塞修到真实 owner 配置上，没有新增运行时分支。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。修复点保持在 `nextclaw` 包自己的 tsconfig owner，没有把路径修正扩散到源码层，也没有引入额外兼容逻辑。
- 目录结构与文件组织是否满足当前项目治理要求：满足。此次只修正现有包路径映射，未新增目录或文件角色。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次唯一手写代码变更是 tsconfig 路径映射修正，`post-edit-maintainability-guard` 判定为 “no changed code-like files found”；因此本轮不做代码式 maintainability 复核，改以配置 owner 清晰度和 release 主路径是否更直接作为判断依据。

## NPM 包发布记录

- 本次是否需要发包：需要。
- 需要发布哪些包：
  - `nextclaw`
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/ui`
- 每个包当前是否已经发布：
  - `nextclaw@0.18.7`：已发布
  - `@nextclaw/agent-chat-ui@0.3.10`：已发布
  - `@nextclaw/ui@0.12.15`：已发布
- 本次未重新发布但在自动 release 中同步了本地 tag 的包：
  - `@nextclaw/app-runtime@0.7.0`：registry 已发布，仅补本地 tag
  - `@nextclaw/app-sdk@0.1.0`：registry 已发布，仅补本地 tag
- 阻塞或触发条件：
  - 首次阻塞为 `nextclaw` release check 的 tsconfig path 映射错误，已在本轮修复并解除。
