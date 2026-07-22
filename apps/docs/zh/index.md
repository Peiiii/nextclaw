---
layout: home

hero:
  name: NextClaw 文档
  text: 让 Agent 把任务做成真实结果
  tagline: NextClaw 可以在你自己的设备上读取资料、使用工具、操作文件并生成可检查的文档、图表、代码和应用。这里从第一个任务开始，讲清每一步怎么用。
  actions:
    - theme: brand
      text: 创建第一个任务
      link: /zh/guide/create-task
    - theme: alt
      text: 查看任务案例
      link: /zh/tasks/
---

## 一项任务会经历什么

你给出目标、材料和工作目录。Agent 读取相关内容，按需要使用模型、技能、浏览器、终端和本机文件；你可以观察、补充或停止，最后在同一个工作区检查实际产物。

<div class="nc-docs-lifecycle">
  <div><span>1</span><strong>说清要交付什么</strong><p>说明材料、结果格式、保存位置和不能触碰的边界。</p></div>
  <div><span>2</span><strong>Agent 执行任务</strong><p>读取文件，调用工具，运行命令，打开网页或拆出子任务。</p></div>
  <div><span>3</span><strong>随时跟进和调整</strong><p>查看正在发生的操作，回答澄清问题，修正方向或停止执行。</p></div>
  <div><span>4</span><strong>检查真实结果</strong><p>打开回复、文件、源码、Markdown、HTML、图片或 Panel App。</p></div>
</div>

<figure class="nc-docs-product-shot nc-docs-product-shot--wide">
  <img src="/product-screenshots/nextclaw-hero-workbench-cn.png" alt="NextClaw 会话与电子钢琴 Panel App 同时打开">
  <figcaption>对话、执行过程和可交互结果留在同一个任务里。</figcaption>
</figure>

## 从一个真实任务开始

<div class="nc-docs-path-grid">
  <a class="nc-docs-card" href="/zh/guide/install">
    <span class="nc-docs-step">第一步</span>
    <strong>安装并配置一个模型</strong>
    <span>桌面版适合直接使用；npm 和 Docker 适合终端、服务器与长期托管。</span>
  </a>
  <a class="nc-docs-card" href="/zh/guide/create-task">
    <span class="nc-docs-step">第二步</span>
    <strong>选择目录并描述结果</strong>
    <span>拿一份真实材料开始，说明输出格式、保存位置和检查标准。</span>
  </a>
  <a class="nc-docs-card" href="/zh/guide/results">
    <span class="nc-docs-step">第三步</span>
    <strong>打开产物并继续修改</strong>
    <span>检查实际文件、图表或页面，再沿用当前上下文提出下一步。</span>
  </a>
</div>

## 工作时，结果就在会话旁边

本地文件、Markdown、代码、HTML、文档、表格和演示文稿都可以在会话右侧打开。HTML 可以查看源码和渲染结果，代码修改可以检查差异，不需要在聊天窗口和外部软件之间反复寻找产物。

<figure class="nc-docs-product-shot">
  <img src="/product-screenshots/nextclaw-workspace-preview-cn.png" alt="NextClaw 会话右侧打开本地 HTML 数据分析报告">
  <figcaption>在会话旁查看项目文件和 HTML 数据报告。</figcaption>
</figure>

<div class="nc-docs-link-grid">
  <a class="nc-docs-link" href="/zh/guide/chat"><strong>任务与会话</strong><span>让目标、消息、操作和后续修改留在一起。</span></a>
  <a class="nc-docs-link" href="/zh/guide/workspace"><strong>会话工作区</strong><span>查看项目文件、打开文件、子任务和定时任务。</span></a>
  <a class="nc-docs-link" href="/zh/guide/results"><strong>结果与预览</strong><span>检查文档、源码、HTML、表格和实际文件。</span></a>
  <a class="nc-docs-link" href="/zh/guide/doc-browser"><strong>Doc Browser</strong><span>把网页、文档和多个浏览标签留在全局右侧。</span></a>
</div>

## 用熟悉的 Agent Runtime 继续项目

同一个任务可以选择 Native、Codex、Claude Code、OpenCode 或 Hermes 来执行。会话、项目目录和生成结果仍留在 NextClaw 里。下面这个真实任务使用 Codex 整理项目架构，右侧同步查看 Markdown 文档。

<figure class="nc-docs-product-shot nc-docs-product-shot--wide">
  <img src="/product-screenshots/nextclaw-codex-runtime-markdown-preview-cn.png" alt="NextClaw 使用 Codex 推进项目并在右侧预览 Markdown 架构文档">
  <figcaption>使用 Codex 推进项目，生成的文档可以直接在任务旁查看。</figcaption>
</figure>

[查看 Claude Code、Codex 与 Hermes 集成](/zh/guide/tutorials/claude-codex-hermes)

## 把常用工作变成自己的 Agent 和应用

专用 Agent 可以保留身份、主目录、记忆、技能和运行时。跑通的步骤可以整理成 Skill，需要外部系统时接入 MCP；如果结果适合长期操作，还可以做成留在右侧的 Panel App。

<div class="nc-docs-showcase-grid">
  <figure class="nc-docs-product-shot">
    <img src="/product-screenshots/nextclaw-agents-page-cn.png" alt="NextClaw Agent 管理界面中的多个专业 Agent">
    <figcaption>为不同工作准备独立 Agent。</figcaption>
  </figure>
  <figure class="nc-docs-product-shot">
    <img src="/product-screenshots/nextclaw-panel-app-running-cn.png" alt="NextClaw 会话旁运行本地 Panel App">
    <figcaption>把一次生成的页面变成可以继续使用的小应用。</figcaption>
  </figure>
</div>

<div class="nc-docs-link-grid">
  <a class="nc-docs-link" href="/zh/guide/multi-agent"><strong>Agents</strong><span>隔离角色、目录、技能和执行环境。</span></a>
  <a class="nc-docs-link" href="/zh/guide/skills-and-mcp"><strong>Skills 与 MCP</strong><span>沉淀做事方法，接入更多工具和数据。</span></a>
  <a class="nc-docs-link" href="/zh/guide/panel-apps"><strong>Panel Apps</strong><span>在任务旁持续使用仪表盘、表单和工具。</span></a>
  <a class="nc-docs-link" href="/zh/guide/tools"><strong>工具与操作</strong><span>理解文件、终端、网页、消息和图片操作。</span></a>
</div>

## 直接照着做的任务案例

<div class="nc-docs-task-grid">
  <a class="nc-docs-card" href="/zh/tasks/data-analysis"><strong>抓取数据并生成图表报告</strong><span>清洗网页或表格数据，交付图表、结论和 HTML 报告。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/file-processing"><strong>整理一批本地文件</strong><span>先预览，再分类、重命名、提取内容并保留记录。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/research-writing"><strong>调研多个来源并标注出处</strong><span>比较网页和已有材料，写成可核对的研究文档。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/writing"><strong>根据资料写文章或报告</strong><span>先核对事实和结构，再生成可以继续编辑的初稿。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/feedback-analysis"><strong>汇总用户反馈并排优先级</strong><span>合并重复问题，统计频次，并保留匿名原始证据。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/image-creation"><strong>生成图片并保存到本地</strong><span>从用途和构图开始，比较结果并继续调整。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/build-local-app"><strong>开发一个本地小应用</strong><span>生成 HTML、脚本或 Panel App，在右侧直接调试。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/code-project"><strong>检查并修改代码项目</strong><span>复现问题、修改实现、运行检查并验收真实页面。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/scheduled-brief"><strong>定时生成并发送简报</strong><span>手动跑通后，设置时间、工作目录和发送渠道。</span></a>
  <a class="nc-docs-card" href="/zh/tasks/chat-channel-work"><strong>从微信或飞书发起任务</strong><span>让本机 Agent 接住请求，完成后把结果发回来。</span></a>
</div>

## 让任务按时运行，也能从聊天工具进来

定时任务适合日报、巡检和周期汇总；消息渠道让你从微信、飞书、Telegram、Slack 等入口发送请求或接收结果。先在本地手动跑通，再交给自动化长期运行。

<div class="nc-docs-showcase-grid">
  <figure class="nc-docs-product-shot">
    <img src="/product-screenshots/nextclaw-cron-job-page-cn.png" alt="NextClaw 定时任务管理界面">
    <figcaption>查看启用状态、上次执行和下次运行时间。</figcaption>
  </figure>
  <figure class="nc-docs-product-shot">
    <img src="/product-screenshots/nextclaw-channels-page-cn.png" alt="NextClaw 消息渠道配置界面">
    <figcaption>把常用消息入口连接到自己的 Agent。</figcaption>
  </figure>
</div>

## 安装、配置与参考

<div class="nc-docs-link-grid">
  <a class="nc-docs-link" href="/zh/guide/install"><strong>安装方式</strong><span>比较 Desktop、npm 和 Docker。</span></a>
  <a class="nc-docs-link" href="/zh/guide/model-selection"><strong>模型与提供方</strong><span>接入云端、本地或自定义模型。</span></a>
  <a class="nc-docs-link" href="/zh/guide/security-and-permissions"><strong>安全与权限</strong><span>检查目录、密钥、渠道和外部工具的边界。</span></a>
  <a class="nc-docs-link" href="/zh/guide/troubleshooting"><strong>故障排查</strong><span>从运行状态、日志和连接问题开始定位。</span></a>
  <a class="nc-docs-link" href="/zh/guide/configuration"><strong>配置手册</strong><span>查找完整配置项和运行设置。</span></a>
  <a class="nc-docs-link" href="/zh/guide/commands"><strong>命令索引</strong><span>按命令名快速查找终端用法。</span></a>
  <a class="nc-docs-link" href="/zh/notes/"><strong>产品更新</strong><span>查看每个版本新增、增强和修复了什么。</span></a>
  <a class="nc-docs-link" href="/zh/project/"><strong>项目与社区</strong><span>查看愿景、路线图、动态和社区入口。</span></a>
</div>
