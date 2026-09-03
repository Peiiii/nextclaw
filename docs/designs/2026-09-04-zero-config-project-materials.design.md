# Projects 零配置材料链设计

## 背景

Projects 已经使用 Project Store 管理项目身份，使用 Project Work 管理工作项、状态、活动和产物关联，但“产物、Skills、工作约定”仍共用旧的 `ProjectObservationService`。这条链每次读取 `.nextclaw/project.yaml`，按配置扫描项目文件和 Skill 目录，还会先列出全部会话再按项目路径过滤。Kernel 启动时另有一次 `listSessions() -> importSessionProjects()` 的历史项目发现。

旧 Marker 解析已经删除，但旧配置字段仍被通用校验器转成诊断并显示在“工作约定”中。这证明删除只到达 Marker 层，没有清除承载它的配置、观测和会话投影机制。

## 最终结果

Projects 不再读取专用项目配置，不再通过 Projects 链扫描全部会话或项目目录；项目身份、产物、Skills 和工作约定分别由唯一事实源提供，项目页的现有用户入口保持可用。

## 用户任务

用户打开一个已注册项目，可以查看工作项明确关联的产物、项目根目录 `.agents/skills` 中的 Skills，以及根 `AGENTS.md` 工作约定；无需创建或维护 `.nextclaw/project.yaml`，也不会因为历史配置或会话产生诊断卡片。

## 当前链路与问题

```text
.nextclaw/project.yaml
  -> ProjectObservationService
  -> config / context / artifact globs / skill roots
  -> ProjectObservationSnapshot
  -> artifacts / skills / agreement UI

all session summaries
  -> ProjectObservationService.observeSessions
  -> snapshot.runs
  -> UI event invalidation + CLI session count

all session summaries at kernel start
  -> ProjectManager.importSessionProjects
  -> implicit project registration
```

问题包括：

- 项目目录中的可选配置仍实际控制用户可见结果，“可选”不等于“不依赖”。
- 文件扫描把“匹配路径的文件”误当作“用户认可的产物”。
- `snapshot.runs` 已无项目页展示消费者，却维持全量会话读取和刷新链。
- 历史会话仍能在每次启动时静默改变 Project Store，形成第二个项目注册入口。
- `sources`、`diagnostics`、`dataQuality` 只服务已过期的混合观测模型。

## 方案比较

### 方案 A：Project Work 显式产物，采用

只有通过 Project Work 关联的项目内文件才是产物。完整产物页复用现有去重、分页和文件存在性查询；Overview 继续展示最近产物。

优点是复用现有权威 owner，零配置、高信噪比，AI、CLI 和 UI 使用同一合同。代价是未关联的普通文件不会自动出现；这是有意语义，而不是功能缺失。

### 方案 B：独立 Project Artifact Store，放弃

把产物升级为可脱离工作项存在的一等持久实体，再让工作项引用它。它能覆盖“无工作项产物”，但会新增数据库、CRUD、迁移和生命周期；当前没有独立消费者证明这层复杂度必要。

### 方案 C：固定目录或全目录扫描，放弃

用内置目录约定代替 YAML glob。它看似零配置，但仍以隐式规则猜测产物，不同项目结构下会产生遗漏和噪声，也会保留第二条事实链。

## 目标架构

```text
Project Store
  -> project id / name / root path

Project Work
  -> work items / states / activities / artifact links
  -> paginated distinct artifact projection
  -> Overview + Artifacts tab

Project Material Service
  -> <project>/.agents/skills
  -> Skills tab
  -> <project>/AGENTS.md existence
  -> Working rules tab

Chat session catalog
  -> Chat UI only
  -/-> Project materials
  -/-> implicit project registration at every startup
```

### Owner 与公共合同

- `ProjectManager`：唯一拥有项目注册、移除、名称和根路径；不从历史会话恢复项目。
- `ProjectWorkManager`：唯一拥有产物关联。产物身份为规范化项目相对路径；同一路径多次关联时，项目产物列表按路径去重并使用最近关联投影。
- `ProjectMaterialService`：只拥有两项有界只读查询：固定目录的项目 Skills，以及根 `AGENTS.md` 是否存在。它不读取配置、会话或任意产物目录。
- Chat Session：继续拥有会话列表和项目绑定；项目页中的聊天工作区复用现有 Chat 状态，不建立 Projects 会话投影。

不新增可配置路径、artifact registry、通用 material registry 或兼容 adapter。

## 用户可见行为

### 产物

- 产物页展示 Project Work 已关联产物，按相对路径去重。
- 默认按最近关联时间排序，支持继续分页和路径搜索；不再按 YAML category 分组。
- 每条展示 label（存在时）、相对路径、最近关联的工作项、关联时间和文件可用状态。
- 文件缺失时保留关联记录并显示“不可用”，不静默删除历史。
- 空态明确说明需要先在工作项中关联产物。
- `project.work.changed` 继续使 Overview、产物页和工作项详情失效刷新。

### Skills

- 只扫描 `<project>/.agents/skills`，使用现有 `SkillsLoader` 和固定的 `DEFAULT_PROJECT_SKILLS_DIR_NAME`。
- 不支持项目自定义 Skill 根路径；目录缺失时返回空列表。
- 点击 Skill 使用项目根路径解析并打开真实 `SKILL.md`。
- CLI 已可通过 `nextclaw skills installed --workdir <project> --scope project` 使用同一默认约定，不新增重复 Projects 命令。

### 工作约定

- 只展示根 `AGENTS.md` 这一份权威工作约定。
- 文件存在时可以打开预览；不存在时显示明确空态。
- `CLAUDE.md` 等兼容软链接不重复展示。
- 删除“愿景与上下文”“来源健康度”和内部诊断卡片。项目摘要如未来需要编辑，应进入 Project Store 的正式字段，不从项目文件推断。

## 删除范围

- 删除 `ProjectObservationService`、配置/文件扫描/projection utils 及其测试。
- 删除 `ProjectObservationSnapshot`、reference/source/run/category/diagnostic/data-quality 类型。
- 删除 observation HTTP controller、路由、SDK `getObservation()`、CLI `projects observe` 与对应测试。
- 删除 UI `useProjectObservation`、基于 session event 的刷新、旧产物分类组件逻辑和旧工作约定诊断界面。
- 删除 Kernel 启动时 `listSessions() -> importSessionProjects()` 以及 `ProjectManager.importSessionProjects()`。
- 更新 Projects 各层 `AGENTS.md`，删除已失效的观测合同，保留 Project Work 和固定材料查询边界。
- 更新中英文 Projects 用户文档与 CLI 能力全集，不再说明 `.nextclaw/project.yaml` 或 `projects observe`。
- 历史 design、plan、log、changelog 中的事实记录保留，不把历史文字误判为运行时入口。

## 数据与迁移边界

- 不迁移 `.nextclaw/project.yaml`：文件不再被读取，其内容不再影响产品。
- 不自动删除用户项目目录中的旧文件，避免把停止依赖扩大成用户数据删除；已确认的测试目录可在交付时单独清理，但不属于运行时迁移。
- 已存 Project Work artifact link 原样保留，无数据库迁移。
- 已注册项目保留在 Project Store。历史会话中存在但从未注册的目录不再被启动扫描静默注册，用户可通过“添加已有项目”明确加入。
- 不提供 legacy fallback、未知字段诊断或永远返回空数组的兼容字段。

## 失败与恢复

- 项目不存在：材料与产物 API 返回既有 `PROJECT_NOT_FOUND`。
- `.agents/skills` 不存在：Skills 返回空列表；单个 Skill 无法读取时返回有界错误信息，不影响工作项和产物。
- `AGENTS.md` 不存在：返回 `available: false`，UI 显示空态，不作为项目健康错误。
- 产物文件不存在：返回 `exists: false`，保留 link。
- 刷新或重进：所有结果从 Project Store、Project Work 和当前文件状态重建，不依赖前端缓存恢复业务事实。

## Active acceptance contract

- `contract-id`: `zero-config-project-materials-v1`
- `parent-goal`: Projects 完全退出专用配置和冗余会话扫描，同时保持产物、Skills、工作约定和项目工作流可用，并合入本地主干。
- `scope-revision`: 1（用户确认仅合入本地 `master`，不推送远端）

| ID      | Required | 验收合同                                                                     | Status  | 当前证据 |
| ------- | -------- | ---------------------------------------------------------------------------- | ------- | -------- |
| ZCP-001 | true     | 产品源码、公共合同和当前文档不再读取或要求 `.nextclaw/project.yaml`          | passed  | 残留扫描仅命中“旧配置应被忽略”的回归测试、changeset 与历史文档；材料服务没有配置入口 |
| ZCP-002 | true     | Projects 请求和 Kernel 启动不再为项目功能调用全量 `listSessions()`           | passed  | 冷启动回归测试断言 `sessionManager.listSessions` 调用为 0；Projects 源码定向扫描无命中 |
| ZCP-003 | true     | 项目 Skills 固定从 `.agents/skills` 加载，目录缺失为空，打开路径正确         | passed  | Kernel 材料服务测试、Server/SDK/Hook/组件测试通过，旧 YAML 自定义路径不会生效 |
| ZCP-004 | true     | 产物页只消费 Project Work 显式关联，去重、分页、搜索、文件缺失和实时刷新可用 | passed  | Project Work manager/store、SDK、Hook 与 UI 产物测试覆盖全部场景并通过 |
| ZCP-005 | true     | 工作约定只消费根 `AGENTS.md`，存在/缺失两态可用且无配置诊断                  | passed  | Kernel、Server、SDK 与 UI 材料测试覆盖存在、缺失、打开和错误态并通过 |
| ZCP-006 | true     | observation service/API/SDK/CLI/UI/types/tests 与无消费者残留全部删除        | passed  | 旧实现文件已删除；精确残留扫描为零；旧 HTTP endpoint 回归测试返回 404，CLI help 无 observe |
| ZCP-007 | true     | Overview、工作项列表/看板、详情抽屉、产物打开和项目聊天工作区无功能回归      | passed  | Projects UI 全功能集 11 files / 37 tests 通过，Vite build 通过 |
| ZCP-008 | true     | 受影响包定向测试、TypeScript、治理检查、真实链路验证和 diff-only Review 通过 | passed  | 104 项定向测试、7 包 TypeScript、完整构建、ESLint、治理与产物扫描通过；Review 50 files / 0 errors / no findings |
| ZCP-009 | true     | 变更精确提交并合入本地 `master`，不推送、不发布                              | not-run | 待交付   |

## 验收场景

1. 已注册项目包含旧 `.nextclaw/project.yaml`：项目页不读取、不报错，也不受其 summary、glob 或 skill root 影响。
2. 项目拥有 `.agents/skills/demo/SKILL.md` 和根 `AGENTS.md`：两个页面分别显示并能打开对应文件。
3. 项目没有 Skills 或 `AGENTS.md`：页面各自显示空态，不产生数据质量告警。
4. 两个工作项关联同一路径：产物列表只出现一次；解除最新关联后仍由剩余关联提供投影，全部解除后消失。
5. 关联文件被删除：产物仍存在于列表并显示不可用。
6. 打开产物、Skills、工作约定或启动 Kernel：Projects 不调用 `listSessions()`，也不读取消息正文。
7. 工作项/产物关联变化：Overview、产物页和详情抽屉刷新到提交后的当前状态。
8. CLI 中旧 `projects observe` 不再注册；Skills 仍可用统一 `skills installed --workdir ... --scope project` 查询。

## 非目标

- 不删除 Chat 自身为侧边栏、搜索或会话切换维护的会话目录。
- 不新增项目摘要编辑、独立 Artifact Store、产物自动分类或任意目录浏览器。
- 不自动删除任意用户项目中的旧 `.nextclaw/project.yaml`。
- 不推送远端、不发布、不部署。

## 设计审计

- **information-expert**：项目身份归 Project Store，交付关系归 Project Work，文件约定只由有界材料查询读取。
- **single-complete-owner**：删除 YAML、目录扫描和 session projection 三条平行事实链。
- **deletion-first**：先删除 observation 混合抽象，再补两个最小只读材料合同。
- **过小端风险**：只隐藏诊断会继续读取配置和会话，无法满足零依赖。
- **平衡点**：复用已存在的 artifact query 与 SkillsLoader，只新增有真实消费者的材料查询。
- **过大端风险**：独立 Artifact Store 或通用 material registry 会新增未被当前用户任务证明的状态和迁移。

`design-document: required`；`plan: required`。

## 验证基线说明

- `check:skill-progressive-loading` 在隔离分支和未修改的本地 `master` 上都因 Skill 总体积超预算 42 字节失败；本批未修改项目 Skill 或渐进加载规则，不把既有基线冒充为本次回归。
- `docs:check-app-client-api` 在隔离分支和未修改的本地 `master` 上都报告同四个 Portable Runtime README 映射缺项；本批 Projects SDK 变更已由 SDK 测试、TypeScript、dist 声明和当前用户文档覆盖。
