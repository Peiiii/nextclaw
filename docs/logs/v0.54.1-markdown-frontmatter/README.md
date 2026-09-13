# Markdown front matter 展示

## 迭代完成说明

Markdown 文件预览和聊天统一支持 YAML front matter：独立、可折叠的文档属性区域，以键值展示字段，复杂值保留 YAML 表达，异常元信息显示原文，正文目录不再混入元信息。设计见 [设计记录](../../designs/2026-09-14-markdown-frontmatter.design.md)。

原渲染器没有 front matter 扩展；接入 remark-frontmatter 后，还须避开默认丢弃 YAML 节点的 HTML 转换处理，交给专用属性组件。真实渲染测试保护这一边界。

## 测试/验证/验收方式

51 项 Markdown 组件测试、两个相关包 tsc、定向 ESLint 与文件治理检查已通过。真实资源页验证默认/暗夜主题、420px 窄屏、点击和 Enter 折叠展开、目录及原始源码。视觉偏好由用户判断，未声称与 ChatGPT 当前版本完全等同。

提交前隔离 worktree 冷安装发现锁文件遗漏 `format@0.2.2` snapshot，补齐后执行 frozen/offline 安装确认完整性。复盘事实保留于本记录：现有 node_modules 的功能测试不能证明锁文件可重建；本次通过真实冷安装覆盖，不增加全局规则。

## 发布/部署方式

用户授权合入主干；精确提交后保留远程新发布提交，普通推送并运行主线协调入口。未授权软件发布或部署。

## 用户/产品视角的验收步骤

打开带 YAML front matter 的 Markdown 文件：顶部显示“文档属性”；点击标题收起，再通过 Enter 展开；目录只包含正文标题；源码中保留完整 YAML。

## 可维护性总结汇总

复用唯一 Markdown 渲染 owner，不增加业务状态或预览入口。新增展示组件与局部解析工具，无平行渲染器。自动维护性检查 0 errors；既有文件预算及目录例外 warnings 经主观复核无阻塞，未扩大为无关重构。

## NPM 包发布记录

不涉及 NPM 包发布。`@nextclaw/agent-chat-ui`、`@nextclaw/ui` changeset 已准备，待统一发布。
