# Bibo Personal Agent 界面概念演示

`public/` 提供四套完整的交互概念：通讯优先、今日节奏、Bibo 来信、共同工作桌。每版有概览、独立对话、收件箱、日程、待办和笔记；各模块在整页使用，不使用小弹窗。对话旁的工作区可切换邮件、日程、待办、笔记和草稿，宽屏并排、窄屏顺序排列。设计依据见[界面设计方案](../../docs/designs/2026-09-25-bibo-personal-agent-interface-concepts.design.md)。`public/desk-original.html` 单独保存最初的共同工作桌视觉稿。所有内容都是虚构示例，状态只保留在当前页面会话，未连接真实 AI、账户或个人数据。

## 本地预览

Studio 本轮补充：侧栏可收起并记忆；文件左侧目录树可独立折叠，右侧多标签打开、切换、关闭并恢复；「任务」提供列表／看板、新建与编辑、状态、项目、优先级、截止日期及子任务。概览任务与模块同源。手机目录与内容分步呈现。完整能力及未实现项见设计文档 S/F/T 清单。

新版 `studio.html`：暖白／鼠尾草绿概览，独立笔记与文件入口。笔记支持新建、搜索、编辑、重命名、移动；文件支持目录浏览、新建文件夹和文档／图表预览。两入口共用浏览器本地存储，刷新保留；未接入真实文件系统。手机使用底部导航及分步编辑，桌面使用侧栏与并排编辑。原四套概念稿保持独立。

在仓库根目录运行：

```sh
python3 -m http.server 4198 --directory concept-demos/bibo-personal-agent/public
```

打开 `http://127.0.0.1:4198/`。四版都可从首页进入。

## Cloudflare 部署

使用独立的静态资源 Worker 发布到 `workers.dev`，不绑定 `bibo.bot` 或 `app.bibo.bot`。在仓库根目录运行：

```sh
pnpm exec wrangler deploy --config concept-demos/bibo-personal-agent/wrangler.jsonc
```

公开 URL 以 Wrangler 实际输出为准。部署后核对首页、四版、工作桌初稿、样式与脚本，以及未知路径的 404。这个命令只发布本演示目录；后续其他概念演示各自使用独立配置和 Worker 名称。
