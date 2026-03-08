# v0.12.72 config-meta workspace star policy

## 迭代完成说明（改了什么）
- 在 `AGENTS.md` 的 `Project Rulebook` 新增规则 `workspace-star-for-internal-packages`。
- 规则明确：本仓库内部 `@nextclaw/*` 包之间依赖默认统一使用 `workspace:*`，避免打包/构建链路解析到旧发布版本。
- 该规则用于固化近期 desktop 启动失败根因修复经验（内部依赖版本混装导致运行时导出不匹配）。

## 测试/验证/验收方式
- 文档结构验证：
  - 确认 `AGENTS.md` 中新增规则包含完整模板字段（约束/适用范围、示例、反例、执行方式、维护责任人）。
- 规则可执行性验证：
  - 依赖变更后执行 `pnpm install`。
  - 执行 `pnpm desktop:package` 与 `pnpm desktop:package:verify`，验证打包产物运行链路可启动。

## 发布/部署方式
- 本次为规则治理变更，不涉及生产部署。
- 合并后即生效，后续所有内部依赖变更与 desktop 打包流程按新规则执行。

## 用户/产品视角的验收步骤
- 研发执行内部依赖调整后，用根目录命令完成打包与验证。
- 验收标准：
  - 安装后 desktop 可直接打开，不出现 runtime init 导出不匹配错误。
  - 团队后续 PR 中不再出现内部包依赖写成 `^x.y.z` 导致的版本混装回归。
