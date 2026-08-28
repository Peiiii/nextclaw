# Panel Apps

Panel App 是在 NextClaw 右侧使用的轻量本地应用。它适合承载仪表盘、表单、计算器、数据浏览器和临时工作台，让一次任务生成的结果可以继续操作，而不只是留下一张图或一份静态文件。

![会话旁运行的 Panel App](/product-screenshots/nextclaw-panel-app-running-cn.png)

## 什么时候使用

- 数据报告需要筛选、切换指标或查看详情。
- 重复计算适合做成表单或计算器。
- 一组本地文件需要持续浏览和操作。
- 生成的 HTML 页面需要留在任务旁边继续使用。

## 创建一个 Panel App

直接描述用途、输入和交互即可，例如：

<div class="nc-task-prompt">
  <p>把当前销售分析结果做成一个本地 Panel App。支持按月份和产品线筛选，显示销售额、利润率和趋势图。读取现有 analysis-output 数据，不要修改原始 CSV。</p>
</div>

Agent 可以生成 `.panel.html` 或带清单的应用，再在右侧打开预览。先验证真实数据、交互和窄屏布局，再决定是否长期保留。

## 应用列表与引用

已创建的 Panel App 可以在应用列表中管理，并在会话输入中通过引用重新带入任务。这样可以让 Agent 根据已有应用继续修改，而不用重新解释文件位置。

![Panel Apps 列表](/product-screenshots/nextclaw-panel-apps-page-cn.png)

## Service Apps

如果 Panel App 需要本地运行时或受控操作，可以配合 Service App。授权前要确认它提供哪些动作、可访问哪些文件或服务，并只开放完成任务所需的范围。

Service Apps 页面会列出每个 Service Action。可以从动作旁的授权入口选择一个 Agent；授权后，该 Agent 会把同一个 Action 作为工具发现和调用。授权可以随时撤销，未授权的 Agent 不会看到该工具。

如何连接 Service、确认 Panel 授权和把 Action 交给 Agent，见 [Service Apps](/zh/guide/service-apps)。

## 应用数据与卸载

NextClaw 把可安装的代码与会变化的应用数据分开管理。更新应用时只替换代码，继续使用原来的受管实例；卸载应用或从 workspace 移除 Service App 时也默认保留实例，之后重装仍可接着使用。

删除对话框提供两个明确选择：

- **保留数据**：移除应用，保留受管实例。
- **删除应用和数据**：经过破坏性确认后，同时移除应用和受管实例。

确认前，NextClaw 会显示受管实例的完整路径，以及数据、配置、状态、缓存、临时文件和日志分别占用的空间。卸载后保留的实例仍会出现在应用页中，可以稍后独立删除。用户另行授权给应用、但位于受管实例之外的文件或目录，不会被这两种清理流程删除。

也可以通过运行中的 NextClaw 主机检查和清理：

```bash
nextclaw app data list --json
nextclaw app data delete <data-id> --confirm <app-id> --json
```

独立删除只接受已经卸载或移除的 `retained` 数据。请从最新清单复制不透明的 data id，并让 `--confirm` 与 App id 完全一致；不要手工删除存储目录。

相关文档：[会话工作区](/zh/guide/workspace) · [查看任务结果](/zh/guide/results) · [Service Apps](/zh/guide/service-apps)
