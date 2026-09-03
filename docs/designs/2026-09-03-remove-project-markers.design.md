# 移除项目 Marker 观测链

## 背景

Project Work API 已成为工作项、状态、活动与产物关联的唯一 owner，但旧的项目只读观测仍会扫描项目会话正文中的 `nextclaw.project/v1` Marker。历史消息或示例文本一旦包含不完整协议行，项目主页“工作约定”页就会把 `PROJECT_MARKER_INVALID` 连续渲染为诊断卡片。

这不是展示层问题：producer 仍在教 AI 生成 Marker，kernel 仍在解析 Marker，projection 仍以 Marker 重建业务事实，UI 仍消费 Marker request。只隐藏诊断会保留错误事实链。

## 目标与可观察结果

- 项目观测不再读取会话消息正文，也不再识别或诊断 `nextclaw.project/v1`。
- 历史 Marker 只作为普通历史消息存在，不参与当前项目状态。
- 项目工作项只来自 Project Work API；项目产物关联只来自 Project Work 数据，完整产物页仍可按项目配置扫描文件。
- 项目主页不再显示 Marker 请求和 Marker 解析诊断。
- 内置 Agent Skill 与当前用户文档不再指导用户或 AI 创建 Marker。

## 主链路

```text
Project Work API -> ProjectWorkManager/store -> UI work queries
project.yaml + project files + project Skills + session summaries
  -> ProjectObservationService -> artifacts/skills/agreement UI
```

`ProjectObservationService` 只读取项目会话摘要以展示真实 session/run 来源，不读取消息正文。Marker parser、Marker projection、Marker response bridge 和生成 Skill 全部退出主链路。

## 删除边界

- 删除 `project-observation-marker.utils.ts` 及其测试。
- 从 observation service 删除消息读取、Marker 冲突、Marker request response 与 Marker 派生投影。
- 删除 Marker 专属 `ObservedWorkItem`、`ObservedSignal`、`ObservedRequest`、`ObservedActivity` 公共类型和 snapshot 字段；保留不依赖 Marker 的 run、artifact、context、skill 与 diagnostics。
- 删除项目主页的 Marker request UI、响应工具与 presenter 投影。
- 删除内置 `project-observation-setup` Skill，因为其核心产物是 Marker 协议与追踪 Skill；不保留无真实职责的空壳。
- 当前用户文档删除“历史 Marker 继续工作”的承诺，明确历史 Marker 不再解析。

## 旧配置与迁移

不提供旧 Marker 合同的兼容、迁移或静默容忍：`workflows` 与 `observation.markers` 从配置 schema 删除，Marker 专属 snapshot 字段和公共类型直接删除，也不保留永远返回空数组的伪兼容。Project Work API 是唯一替代入口。

仓库自身仍存在的旧项目配置同步删除这些字段；外部旧配置如果继续携带它们，按普通未知字段处理，不恢复任何 Marker 行为。

## 非目标

- 不删除项目配置、上下文、文件产物扫描、项目 Skills 或项目 session 摘要观测。
- 不迁移历史 Marker 数据到 Project Work；不能可靠推断用户是否仍认可历史消息中的状态。
- 不改变 Project Work 的持久化、事件或抽屉交互。

## 验证标准

- 含有效、无效和示例 Marker 文本的项目会话都只被视为普通文本，不会产生 Marker 数据或诊断。
- observation service 不调用 `listSessionMessages`。
- 项目主页不存在 Marker request/response 入口，工作约定页没有 Marker 诊断卡片。
- kernel、server、client SDK 与 UI 的定向测试和 TypeScript 检查通过。
- 用户文档与内置 Skill 清单不再出现当前有效的 `nextclaw.project/v1` 生成说明。
