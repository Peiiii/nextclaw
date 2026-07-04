# 右侧文件预览面包屑导航设计

## 背景

右侧 workspace 文件预览已经展示文件路径面包屑，但每段路径只是静态文本。用户期望它像 VS Code 一样：点击路径段后可以浏览对应目录下的同级与下级文件树，并能直接点击文件进入预览。

这项能力增强的是 NextClaw 作为统一工作入口的文件掌控能力：用户不必离开当前会话工作台或切换外部编辑器，就能从一次文件预览继续探索项目文件结构。

## 现状依据

- 文件预览展示 owner 是 `packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-file-preview.tsx`。
- 面包屑展示 owner 是 `packages/nextclaw-ui/src/features/chat/features/workspace/components/chat-session-workspace-file-breadcrumbs.tsx`。
- 面包屑路径 view model 由 `packages/nextclaw-ui/src/shared/lib/session-project/workspace-file-breadcrumb.utils.ts` 生成。
- 文件内容读取已通过 `useServerPathRead` 走 `serverPaths.read`。
- 目录浏览能力已存在：`useServerPathBrowse` 支持 `includeFiles`，返回 `ServerPathBrowseView.entries`，并区分 `directory` / `file`。
- 文件打开主链路已存在：`ChatThreadManager.openFilePreview` 通过 `onFileOpen` 接收 `ChatFileOpenActionViewModel`，创建或激活 workspace file tab。

## 核心判断

本轮不新建后端 API，也不新建文件系统 manager。正确做法是在已有 owner 上补齐缺失的交互合同：

- breadcrumb util 不只返回 label，还返回每个 segment 的 `path` 与 `browsePath`。
- breadcrumb 组件负责本地弹层打开状态和目录钻取状态。
- 弹层目录数据继续复用 `useServerPathBrowse({ includeFiles: true })`。
- 点击文件继续复用 `onFileOpen({ path, label, viewMode: "preview" })`。

这样保持单一路径：路径事实由 breadcrumb util 生成，目录事实由 server-path browse query 读取，文件预览由 ChatThreadManager 主链路承接。

## 推荐方案

面包屑每个 segment 渲染成 button，并使用 Popover 展示目录浏览器：

- 点击 workspace/root/directory segment 时，弹层初始浏览该目录。
- 点击 file segment 时，弹层初始浏览它的父目录，用来查看同级文件和目录。
- 弹层内目录项点击后在弹层内继续钻取。
- 弹层内文件项点击后关闭弹层，并调用现有 `onFileOpen` 打开文件预览。
- 弹层顶部显示当前浏览目录的 breadcrumbs，方便回退到上级路径。
- 加载、空目录和错误状态复用现有 i18n 文案。

## Owner 与数据流

数据流：

```text
resolvedPath/sessionProjectRoot
  -> buildWorkspaceFileBreadcrumb
  -> ChatSessionWorkspaceFileBreadcrumbs
  -> useServerPathBrowse(includeFiles: true)
  -> onFileOpen(ChatFileOpenActionViewModel)
  -> ChatThreadManager.openFilePreview
  -> useServerPathRead
  -> file preview body
```

Owner 边界：

- `workspace-file-breadcrumb.utils.ts`：拥有路径切片、segment 目标路径和默认浏览路径的纯计算。
- `chat-session-workspace-file-breadcrumbs.tsx`：拥有面包屑交互和弹层本地状态，不持久化、不写 workspace store。
- `useServerPathBrowse`：继续作为目录读取 query owner。
- `ChatThreadManager`：继续作为打开文件 tab 与 workspace navigation 的业务 owner。

## 目录组织

本次保持现有 frontend `app-l3` 结构，不新增 feature root。

- 纯路径 view model 继续留在 `shared/lib/session-project/`，因为它已经是跨 chat workspace 消费的稳定 session-project 工具模块，且该模块以 `index.ts` 作为 `shared/lib/*` 公共入口。
- 面包屑 UI 继续留在 `features/chat/features/workspace/components/`，因为它依赖 chat workspace 的业务打开动作，不应沉到 shared component。
- 测试继续补在相邻 `__tests__` 目录，符合当前 feature 测试组织。

## 可维护性取舍

- 不新增后端接口，复用现有 server-path browse/read 合同。
- 不新增 store，因为弹层打开目录属于短生命周期局部交互状态，不需要刷新恢复。
- 不新增 manager，因为没有新的长期业务状态或跨组件编排；文件打开继续归已有 ChatThreadManager。
- 不复制 path-picker 对话框，只复用同一个 browse hook，并按面包屑弹层场景写更轻的视图。

## 兼容与迁移

无旧数据迁移。原有静态面包屑视觉继续保留，只把 segment 从 `span` 升级为可点击 button。若目录浏览失败，文件预览本身不受影响。

## 验收标准

- 单元测试覆盖 breadcrumb segment 的 `path` / `browsePath`。
- 组件测试覆盖：点击面包屑打开目录弹层、目录项可继续钻取、文件项可调用 `onFileOpen`。
- TypeScript 源码变更后运行 `tsc`。
- 运行 touched package 的定向测试和 ESLint。
- 用户可见行为需要浏览器或最贴近链路的 DOM 交互验证。
- 收尾运行 maintainability guard、governance 与 backlog ratchet。

## 非目标

- 不做递归全量文件树一次性加载。
- 不替代独立文件浏览器或 path picker。
- 不改 workspace file tab 的持久化模型。
- 不新增文件搜索能力。

## 后续实现顺序

1. 扩展 breadcrumb segment view model，补齐 `path` 和 `browsePath`。
2. 将 breadcrumb segment 渲染为 Popover trigger。
3. 弹层内接入 `useServerPathBrowse({ includeFiles: true })`。
4. 文件项点击复用 `onFileOpen`。
5. 更新 breadcrumb util 测试和文件预览组件交互测试。
