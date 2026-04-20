# 当前目标

在 `workers/nextclaw-provider-gateway-api` 上完成严格 `package-l1` 结构治理，并把相关治理系统补齐到同一套预期：

- 顶层只允许通用职责目录与必要入口文件
- 带固定 `.role.ts(x)` 映射的角色目录内部只能直放文件
- 治理器不能再对这条预期漏检、误检，或和别的规则互相冲突

# 最终事实

- 迭代版本：`v0.16.86-nextclaw-provider-gateway-api-maintainability-campaign`
- `src/` 根层直接源码文件数：`25 -> 2`
- `workers/nextclaw-provider-gateway-api/src/configs`、`src/controllers`、`src/services`、`src/utils` 下的领域子目录已全部清空
- worker 仍保持真实 `contractKind: "protocol"` + `protocol: "package-l1"`
- `module-structure` 已新增 flat role dir 真相源，并会阻断角色目录内部子目录
- `file-role-boundaries` 已补齐 `managers / presenters / routes`
- `flat-directories-subtree` 已不再错误要求协议 flat role dir 长子树
- `routes` 命名已继续收正为 [`src/routes/app.route.ts`](/Users/peiwang/Projects/nextbot/workers/nextclaw-provider-gateway-api/src/routes/app.route.ts)
- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`：`36/36`
- `node --test scripts/governance/lint-new-code-file-role-boundaries.test.mjs`：`19/19`
- `node --test scripts/governance/lint-new-code-flat-directories.test.mjs`：`5/5`
- `pnpm -C workers/nextclaw-provider-gateway-api lint`：通过
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`：通过
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`：通过，`10/10`
- `pnpm lint:new-code:governance -- ...`：通过
- `pnpm check:governance-backlog-ratchet`：通过

# 关键动作

- 把 `auth-browser`、`remote-quota`、`remote-relay`、`platform`、`marketplace` 等嵌套在角色目录里的领域子树全部压平
- 补文档 contract，明确固定角色目录只能直放文件
- 补 `module-structure` 检测，阻断 `services/foo/...` 这类路径
- 补 `file-role-boundaries` 对 `routes / presenters / managers` 的角色感知
- 补 `flat-directories-subtree` 与严格 flat role dir 之间的规则协调

# 关键判断

- 这轮真正的根因是“规范、检测器、代码现状”三者不一致。
- 如果只改 worker，不改治理器，后面还会继续误判。
- 如果只改治理器，不改 worker，当前模块自己就还是违规样本。
- 因此必须同时改文档、检测器、测试样例和目标 worker，不能只修其中一层。

# 剩余边界

- 当前这轮已经把“角色目录内禁止子目录”的严格预期落成硬规则并跑通验证。
- 下一轮如果还要继续减债，重点应回到大文件热点本身，例如 `platform.repository.ts`、`remote.controller.ts`、`types/platform.ts`。

# 本轮结论

本轮治理完成，当前可以把“固定角色目录只能直放文件”视为仓库已落地且已被检测系统执行的硬约束。
