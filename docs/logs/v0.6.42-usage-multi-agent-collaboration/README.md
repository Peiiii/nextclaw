# v0.6.42-usage-multi-agent-collaboration

## 迭代完成说明（改了什么）

本次迭代补齐了 `USAGE` 文档中“多 Agent 协作”缺失的可执行内容，重点增强“如何配置 + 如何验收 + 如何排障”：

1. 在 `docs/USAGE.md` 的多 Agent 段落新增协作操作手册：
- `main + specialist` 角色拆分建议
- `bindings` 路由优先级与匹配语义（首条命中、`accountId` 空值与 `*` 语义）
- 三类协作配方（默认+专家路由、跨账号隔离、群聊降噪）
- 验收清单与快速排障映射

2. 同步模板文档：
- 运行同步脚本将 `docs/USAGE.md` 同步至 `packages/nextclaw/templates/USAGE.md`
- 确保 `nextclaw init` 生成的新工作区拿到同版本协作指引

## 测试 / 验证 / 验收方式

### 工程验证

- 本次仅涉及文档与模板同步，无运行时代码逻辑变更。
- 已执行：
  - `node packages/nextclaw/scripts/sync-usage-template.mjs`
- 已核对：
  - `docs/USAGE.md` 新增多 Agent 协作章节
  - `packages/nextclaw/templates/USAGE.md` 同步包含相同章节

### 验收说明

- `build/lint/tsc`：本次改动为文档层，不影响编译产物与类型行为，按规则判定为“不适用”。
- 运行时冒烟：本次未改动可执行逻辑，按规则判定为“不适用”。

## 发布 / 部署方式

- 文档变更无需单独部署后端服务。
- 若发布 NPM 包，沿既有发布流程执行即可；本次变更会随包内 `templates/USAGE.md` 一并发布。
- 对现有已初始化工作区，若需要立即获取新文档，可手动复制或重新执行模板覆盖流程（如 `nextclaw init --force`，会覆盖模板文件）。

## 用户/产品视角验收步骤

1. 打开 `docs/USAGE.md`，确认多 Agent 段落出现以下内容：
- 协作手册（playbook）
- 路由匹配语义（deterministic）
- 协作配方（recipes）
- 验收清单（acceptance checklist）
- 排障映射（troubleshooting map）
2. 打开 `packages/nextclaw/templates/USAGE.md`，确认包含同样章节。
3. （可选）在新工作区执行 `nextclaw init`，确认生成的 `USAGE.md` 含上述协作内容。

验收通过标准：文档可直接指导多 Agent 协作配置、验证与排障，且模板与主文档保持一致。
