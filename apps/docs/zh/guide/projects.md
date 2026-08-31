# 管理项目工作与材料

Projects 页面把一个已注册项目里的工作项、产物、Skills、工作约定和项目会话集中到同一处。项目必须有真实根目录；工作项数据由 NextClaw 独立保存，不会要求你在项目目录中添加 Marker、配置文件或追踪 Skill。

## 查看项目主页

先在聊天侧边栏创建项目或添加已有目录，再点击项目名称打开项目主页。页面保留原有的产物、Skills、工作约定和项目会话能力，同时提供工作项概览、列表与看板。

概览页只请求工作项摘要和最近更新，不会为显示统计而扫描项目文件或重放会话历史。产物、Skills 与工作约定仍在各自页面按需加载。

## 创建和推进工作项

在 **工作项** 页面创建工作项。每个项目首次使用时会获得一组通用状态：Backlog、Planned、In Progress、In Review、Awaiting Acceptance、Completed 和 Canceled。

状态名称和顺序可以按项目调整，也可以增加自定义状态。每个状态同时归属于一个稳定的生命周期类别：backlog、unstarted、started、completed 或 canceled。这样既能自定义流程，又能让概览统计保持一致。删除仍在使用的状态时，需要先选择迁移目标。

工作项的状态变化不会覆盖历史。比如从 In Progress 进入 In Review、评审未通过后回到 In Progress、再次进入 In Review，每次变化都会保留在活动时间线里。

列表、看板和概览中的工作项都可以点击。它们统一在右侧详情抽屉中打开，不会把详情平铺追加到当前页面。抽屉中可以：

- 修改标题、说明、状态和关注标记；
- 查看完整活动时间线；
- 软删除或恢复工作项；
- 关联或移除项目内的产物文件，并直接打开关联文件。

## AI 如何使用工作项

只有归属于某个项目的会话才会获得 Project Work 工具。AI 可以列出、查看、创建和更新工作项，也可以关联或移除产物；不在项目中的会话不会看到这些工具。

工作项表示需要长期追踪的用户意图和交付目标。AI 在一次运行中临时使用的步骤或计划不属于本功能，本功能也不会替换运行计划。

工作项变更通过实时事件通知页面刷新当前数据。事件只承担“发生了变化”的通知，不作为数据库，也不要求读取事件历史。

## 数据与项目目录边界

工作项、状态、活动历史和产物关联存放在 NextClaw 自己的数据目录。项目根路径仍是项目身份和文件边界的一部分，但 NextClaw 不会为了工作项追踪向该目录写入专用文件。

产物关联只接受项目根目录内真实存在的文件。数据库保存相对于项目根目录的路径，因此移动 NextClaw 数据目录时不会把本机绝对路径写进工作项记录。

## 从 CLI 管理

CLI 无法像项目会话一样从上下文得知当前项目，因此所有工作项命令都必须显式传入项目 ID：

```bash
nextclaw projects work list --project <project-id>
nextclaw projects work create "完善项目页" --project <project-id>
nextclaw projects work update <work-item-id> --project <project-id> --state <state-id>
nextclaw projects work activity <work-item-id> --project <project-id>
```

CLI 通过正在运行的本地 NextClaw 服务复用同一套 Kernel 写入合同；服务未运行时会直接报错，不会另起第二个写入进程。完整命令见[命令行参考](./commands.md)。

## 原有项目观测能力

产物、Skills、工作约定和旧版只读观测仍然保留。已有 `.nextclaw/project.yaml`、项目规则、项目 Skill 和历史 Marker 不会因为工作项存储上线而失效；它们只是不再是创建、统计或推进工作项的前置条件。

如需读取旧版观测快照，仍可使用：

```bash
nextclaw projects observe /absolute/path/to/project --json
```
