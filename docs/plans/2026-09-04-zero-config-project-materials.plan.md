# Projects 零配置材料链执行计划

上位设计：[Projects 零配置材料链设计](../designs/2026-09-04-zero-config-project-materials.design.md)

## 目标与范围

删除 `.nextclaw/project.yaml`、Project Observation 混合快照、Projects 全量会话扫描和文件系统产物扫描；将产物、Skills、工作约定分别收敛到 Project Work、固定 `.agents/skills` 和根 `AGENTS.md`。完成源码、公共合同、CLI、UI、规则、用户文档、测试和本地 Git 交付闭环。

## 执行部分

### 1. 收敛 Kernel owner

- owner：`packages/nextclaw-kernel/src/features/projects` 与 Kernel 启动装配。
- 输入：现有 Project Observation、Project Work artifact query、Project Manager 注册链。
- 交付：删除 observation/config/file scan/session projection；新增有界 Project Material 只读 owner；删除启动历史会话导入。
- 设计策略：复用上位设计。
- 验证：Kernel 定向测试证明旧配置完全无效、Skills/AGENTS 两态、artifact 去重与缺失文件、零 Projects `listSessions()`。
- acceptance：ZCP-001、ZCP-002、ZCP-003、ZCP-004、ZCP-005、ZCP-006。

### 2. 收敛 Server、SDK、Service 与 CLI 公共入口

- owner：Projects HTTP、client SDK、CLI command bridge。
- 输入：Kernel 新材料合同与既有 Project Work API。
- 交付：删除 observation route/type/client/command；提供独立材料读取入口；产物继续走 Project Work；CLI 删除 `projects observe`，Skills 复用现有统一命令。
- 设计策略：复用上位设计。
- 验证：路由、SDK、CLI 定向测试及对应 package TypeScript。
- acceptance：ZCP-003、ZCP-004、ZCP-005、ZCP-006。

### 3. 重接 Projects UI

- owner：`packages/nextclaw-ui/src/features/projects`。
- 输入：Project Work artifact pages 与 Project Material 查询。
- 交付：产物页改为显式关联列表；Skills 和工作约定独立加载；删除 observation hook、session invalidation、source health 和 diagnostics。
- 设计策略：复用上位设计；不改变现有 Projects 顶层标签结构。
- 验证：组件与 hook 测试覆盖加载、空态、错误、分页、搜索、打开文件和事件刷新。
- acceptance：ZCP-003、ZCP-004、ZCP-005、ZCP-006、ZCP-007。

### 4. 清理规则、文档与用户说明

- owner：Projects 分层 `AGENTS.md`、中英文 Projects 指南、CLI 能力全集、changeset。
- 输入：最终可用产品链路。
- 交付：当前规则和文档不再声明项目观测或配置入口；面向用户说明显式产物、固定 Skills 与工作约定来源。
- 设计策略：复用上位设计；历史 design/plan/log/changelog 保持历史事实。
- 验证：定向 `rg`、文档/规则治理检查、用户可见措辞扫描。
- acceptance：ZCP-001、ZCP-006、ZCP-008。

### 5. 统一验证、Review 与本地交付

- owner：Validation、Review、Delivery。
- 输入：完整 diff 和 active acceptance ledger。
- 交付：关闭全部 Required acceptance IDs；精确提交；通过主线 reconcile 或等价安全流程合入本地 `master`，明确跳过 push。
- 设计策略：复用上位设计。
- 验证：定向测试、受影响 package `tsc`、必要 lint/治理、真实 API/UI 数据流、diff-only maintainability guard、合入后状态核对。
- acceptance：ZCP-007、ZCP-008、ZCP-009。

## 中断恢复

从首个未完成执行部分恢复，先执行：

```text
git status --short
git diff --stat
rg -n "ProjectObservation|projectObservation|project.yaml|projects observe|importSessionProjects|PROJECT_CONFIG_" packages apps/docs
```

然后对照设计文档中的 active acceptance ledger 更新证据。任何当前源码、公共类型、当前用户文档或运行入口命中都必须分类为待删残留或有明确理由的历史记录；不得仅凭测试通过宣布清理完成。

## 交付边界

- 允许：创建隔离分支、提交本任务变更、合入本地 `master`。
- 禁止：推送远端、创建 PR、发布、部署、重启当前 NextClaw 实例。
- 主工作区如在实施期间出现新的 WIP，不覆盖、不 stash、不 reset；改用安全 reconcile 或报告真实阻塞。
