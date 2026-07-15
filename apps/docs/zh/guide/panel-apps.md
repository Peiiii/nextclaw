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

相关文档：[会话工作区](/zh/guide/workspace) · [查看任务结果](/zh/guide/results)
