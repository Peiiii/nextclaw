# Workspace 唯一真源设计

## 背景

Docker 实例中真实 `NEXTCLAW_HOME` 是 `/data`，默认 workspace 应解析为 `/data/workspace`。但部分 chat session 把 `~/.nextclaw/workspace` 写进了 `project_root`，导致工具执行 workingDir 被解析成不存在的 `/root/.nextclaw/workspace`，`exec` 再报出误导性的 `spawn /bin/sh ENOENT`。

## 现状依据

- `agents.defaults.workspace` 是配置中的 workspace 真源。
- `~/.nextclaw/workspace` 是默认 workspace 的符号值，只应在配置缺省或初始化时出现。
- chat 前端把 `config.agents.defaults.workspace` 当成 `defaultProjectRoot`，新会话发送时又把它写进 `projectRoot/project_root`。
- welcome project picker 会把默认 workspace 补成“最近项目”，并从历史 session metadata 继续展示 legacy `project_root`。
- session project resolver 看到 `project_root` 后，会优先把它当用户显式项目根目录处理。

## 核心判断

workspace 地址必须只有一个真源：配置 owner。`project_root` 不是 workspace 真源，只表示用户对某个 session 显式选择了不同项目目录。

`DEFAULT_WORKSPACE_PATH` 这类符号默认值不能跨层持久化成 session 状态。一旦它进入 `project_root`，系统就丢失了“这是默认 workspace 符号”的语义，并在不同运行环境里被错误展开。

## 推荐方案

1. 前端发送新会话时，未显式选择项目目录就不写 `projectRoot/project_root`。
2. 前端仍可展示默认 workspace 作为当前默认状态提示，但不能把它补成“最近项目”或自动成为 session override。
3. core session project resolver 对历史数据做结构性防线：当 `project_root` 等于默认 workspace 符号或等于当前已解析 workspace 时，不视为显式项目根目录。
4. kernel session summary 边界清理默认 workspace 的 legacy `project_root`，避免 UI adapter、sidebar、welcome picker 继续展示脏状态。
5. `workingDir` 始终由 kernel/session owner 从 `explicitProjectRoot ?? resolvedWorkspace` 派生，AI 不需要、也不应该自行传 cwd。

## Owner 与数据流

```text
Config owner
  agents.defaults.workspace
  -> resolveWorkspacePath(config, env)
  -> real workspace, e.g. /data/workspace

Session metadata
  project_root only when user explicitly selects a different project root

Session/project resolver + summary boundary
  effectiveWorkspace = explicitProjectRoot ?? resolvedWorkspace
  strip legacy default project_root from public session summary

ExecTool
  workingDir = effectiveWorkspace
```

配置 owner 负责默认 workspace 的环境绑定；session owner 只负责保存显式覆盖；UI 只负责展示和提交用户明确选择。

## 目录组织

- 前端发送规则保留在 chat session run metadata 相关 utils 中，属于 chat feature 的发送 metadata owner。
- session project 解析规则保留在 `@nextclaw/core` 的 session project context service 中，属于 workspace/projectRoot 语义 owner。
- session summary 清理放在 kernel working-dir resolver 边界，保证所有 UI summary consumer 读到同一份干净 session 事实。
- 本设计放入 `docs/designs`，因为它定义了稳定 owner、数据流和修复合同，不是单纯想法或执行清单。

## 兼容与迁移

不做一次性数据迁移。历史 session 里已经写入的 `~/.nextclaw/workspace` 由 resolver 防线自动按默认 workspace 处理。若用户未来显式选择了一个真实项目目录，仍按显式 project root 生效。

## 验收标准

- 新会话未显式选择项目目录时，不产生 `project_root` metadata。
- 显式选择项目目录时，仍产生 `projectRoot/project_root`。
- session resolver 遇到默认 workspace 符号时，workingDir 回到当前配置解析出的真实 workspace。
- welcome project picker 不把默认 workspace 作为“最近项目”展示，legacy 默认 `project_root` 不再出现在 project option 中。
- Docker 或自定义 `NEXTCLAW_HOME` 下，默认 workspace 不再被展开到 `/root/.nextclaw/workspace`。
- TypeScript、定向单测、lint、治理和最贴近真实 Docker session API 的冒烟通过。

## 非目标

- 不改变用户手动设置 workspace 的能力。
- 不改变显式 project root 的 UI 展示和编辑能力。
- 不引入新的 workspace manager 或前后端双写状态。

## 后续实现顺序

1. 修复 draft 发送路径，默认 workspace 不再写入 metadata。
2. 在 core session project resolver 中补历史数据防线。
3. kernel session summary 清理默认 workspace 的 legacy project metadata。
4. 用单测和 Docker API 冒烟验证 workingDir 与前端展示事实回到真实 workspace。
