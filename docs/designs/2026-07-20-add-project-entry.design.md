# “添加项目”双路径交互设计

## 背景

当前侧边栏入口和弹窗统一叫“新建项目”，表单同时允许填写一个服务端目录并选择项目模板。这个表达没有区分两种本质不同的用户意图：创建新的项目目录，或者把已经存在的目录加入项目列表。

这会让用户无法判断选择已有目录后是否会执行模板初始化，也让已经存在于 kernel 的“登记已有目录”能力无法从 UI 使用。本设计是对 [项目注册表与会话控制设计](./2026-07-15-project-registry-and-session-control.design.md) 的交互与外部合同补充。

## 现状依据

- `ProjectManager.createProject()` 要求目标目录为空或不存在，会创建目录并按模板写入内容。
- `ProjectManager.registerExistingProject()` 验证目录存在后只写项目注册表，不物化模板；非空目录也允许登记。
- HTTP、client SDK 和 UI 目前只暴露 `createProject`，所以 UI 无法调用已有目录登记链路。
- 现有弹窗把名称、模板和“目标目录”放在同一表单里，用户无法从界面确认已有目录是否会被修改。
- 项目列表以项目注册表为事实源；添加已有目录不需要创建占位会话或第二份前端状态。

## 核心判断

“添加项目”是项目列表的统一入口，入口下包含两个互斥命令：

1. **新建项目**：创建新的项目目录，可选择模板初始化内容。
2. **添加已有目录**：验证并登记已有目录，不创建目录、不写模板、不修改目录内容。

两者不能通过“模板留空”“自动判断目录是否非空”或失败后的 fallback 混成一个请求。用户意图必须在 UI 选择时确定，并一直保持为两个不同的 API 类型和 mutation。

## 推荐方案

### 入口与命名

- 侧边栏入口改为“添加项目”。
- 弹窗标题为“添加项目”，说明文字直接列出“新建项目目录”与“添加已有目录”两个结果。
- 弹窗内使用两个并列选项：“新建项目”和“添加已有目录”；默认选择“新建项目”，保持原有用户路径不增加一步确认。

### 新建项目

- 保留“项目名称”和“项目模板”。
- 将“目标目录（可选）”改为“项目目录（可选）”，明确该路径是项目根目录，不是父目录。
- 留空时，kernel 仍在默认工作目录下创建与项目同名的文件夹。
- 选择或填写路径时，该目录必须为空或尚不存在；模板只在这条命令中生效。
- 主操作文案为“创建项目”，与模式名称“新建项目”区分：前者表达当前提交动作，后者表达所选路径。

### 添加已有目录

- 只要求“已有项目目录”，复用服务端目录选择器。
- 目录选择器在此模式下隐藏“新建文件夹”，避免登记路径重新混入创建目录的意图。
- 项目名称直接取目录 basename；本轮不增加自定义名称字段，避免把登记动作扩成项目编辑表单。
- 界面明确显示“不会修改或初始化目录内容”。
- 主操作文案为“添加到项目列表”。
- 请求体只有 `rootPath`，类型上不允许携带 `template`。

## Owner 与数据流

```text
ChatProjectAddDialog
  ├─ 新建项目 ──> create mutation ──> POST /api/projects
  │                                  └─> ProjectManager.createProject
  │                                      └─> 创建目录 / 物化模板 / 写注册表
  └─ 已有目录 ──> add-existing mutation ──> POST /api/projects/existing
                                         └─> ProjectManager.registerExistingProject
                                             └─> 验证目录 / 只写注册表

两个 mutation 成功后 ──> invalidate 唯一 projects query ──> 项目列表刷新
```

- `ProjectManager` 继续是项目目录规则、模板初始化和注册表写入的唯一 owner。
- server controller 只校验 HTTP 请求形状并映射 kernel 错误。
- client SDK 只暴露两个明确方法，不判断目录状态。
- UI component 只拥有当前弹窗模式和表单输入；不复制文件系统判断或项目业务规则。

该方案落实 `single-fact-owner`、`command-query-shape`、`boundary-only-defense` 和 `predictable behavior`：创建与登记各自只有一条主路径，已有目录不会因猜测或 fallback 进入初始化链路。

## 目录组织

- 不新增 manager、store、helper、factory 或 feature 层级。
- UI 将原 create-only 组件直接重命名为 `chat-project-add-dialog.tsx`，仍留在 `features/chat/features/project/components/`。
- server 继续在既有 `features/projects` 的 controller/types 内增加登记合同。
- client SDK 继续扩展既有 `ProjectsService`。
- kernel 不新增实现路径，直接复用现有 `registerExistingProject()`。

本文件进入 `docs/designs`，因为它定义了稳定用户意图、外部合同、owner 和数据流；它不是待探索 thought，也不是仅描述执行批次的 plan。

## 兼容与迁移

- 保留 `POST /api/projects` 和 `ProjectCreateRequest` 的原有创建语义。
- 不为旧 UI 文案或组件名保留 alias；仓库内调用方直接迁移到“添加项目”入口。
- 已有项目注册表无需迁移。
- 默认 workspace 仍不是普通项目；显式添加默认 workspace 时返回可观察错误，不伪造成功。

## 验收标准

- 侧边栏和弹窗统一显示“添加项目”，弹窗可明确选择两个互斥方式。
- 默认“新建项目”路径仍可选择空项目或知识库模板，并可留空项目目录。
- “添加已有目录”不显示项目模板，提交请求只包含 `rootPath`。
- 非空已有目录可以成功加入项目列表，目录内已有文件的名称和内容保持不变，项目记录不包含 `template`。
- 默认 workspace、缺失路径和非目录路径返回明确错误，不显示成功 toast。
- 两条路径成功后都刷新唯一 `projects` query，零会话项目立即出现在列表。
- 中文和英文文案都表达用户结果，不暴露内部注册、物化等实现术语。
- kernel、server、client SDK、UI 定向测试通过；触达的 TypeScript package 通过 `tsc`、targeted lint 和治理检查。
- 在隔离源码实例的真实 project-first 侧边栏完成两条路径的浏览器冒烟，并确认添加已有目录前后目录内容不变。

## 非目标

- 不增加项目重命名、删除、移动或完整项目管理页。
- 不从目录内容推断模板或项目类型。
- 不把默认 workspace 登记成普通项目。
- 不改变会话绑定项目目录的既有语义。

## 后续实现顺序

1. 增加已有目录的 server/client 合同和定向测试。
2. 将 create-only dialog 收敛为“添加项目”双路径弹窗并更新 i18n。
3. 接通两个 mutation，验证项目列表刷新和错误状态。
4. 完成类型、测试、lint、治理与真实浏览器冒烟。
