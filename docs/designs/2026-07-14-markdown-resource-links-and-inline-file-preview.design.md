# Markdown 资源链接与内联文件预览设计

## 背景

Linear `NC-115` 与 `NC-112` 表面上分别是 Markdown 链接失效和 `nextclaw-inline` 文件无法内联展示，实际属于同一条资源展示链路：消息先声明一个资源目标，产品再把目标归一化为文件打开动作或内联预览，并交给统一文件预览 owner。

当前有两个可复现断点：

- `[源码](file:///Users/example/project/index.js#L5713)` 会在进入点击处理以前被 `react-markdown` 默认 URL 转换和本地资源安全层清空；即使保留链接，现有 parser 也会丢弃 `#L5713`。
- `nextclaw-inline` 已在类型和 parser 中支持 `file` target，但 NextClaw 产品 renderer 只接入了 `panel_app`。文件 target 因而停留在只读占位文本，没有进入已有 workspace 文件预览链路。

本设计不新增第二套文件读取能力，也不为两个失败样本分别打补丁，而是统一链接语法、目标动作和预览 owner。

## 目标与成功标准

### 目标

1. 所有语法成立的 Markdown 链接保持链接语义；安全协议决定是否可执行，不决定是否把链接视觉结构抹掉。
2. 标准 `file:` URI、绝对路径、相对路径和现有行列号写法统一归一化为 `ChatFileOpenActionViewModel`。
3. `nextclaw-inline` 的 `file` target 复用 workspace 文件预览能力，在消息当前位置展示 HTML、Markdown、代码、图片、媒体、PDF 与 Office 文件。
4. Markdown 解析和内联预览均为观察/展示路径，不因 descriptor 解析、页面加载或重试产生文件写入、工具执行或额外的宿主动作。

### 可观察验收

- `file:///.../index.js#L5713` 渲染为可点击链接；点击后打开真实文件内容，保持原始行号，并把第 5713 行滚动到视口中部、以当前行样式强调，而不是在面包屑显示 `L5713` 或把第一行重编号为 5713。
- `file:///C:/.../index.ts#L12C4` 能归一化为 Windows 路径、行号和列号。
- `javascript:` 等危险协议仍显示为禁用链接，不执行、不交给文件 owner。
- `nextclaw-inline` 的 HTML `file` target 在消息内出现真实预览，而不是路径占位文本。
- inline 与 workspace side panel 使用同一 `ChatSessionWorkspaceFilePreview`、同一内容 URL、同一 renderer 分发与同一错误状态。
- HTML `viewer=rendered` 保持现有 workspace 预览语义，内联入口不另造一套受限或降级 renderer。

## 症状与链路地图

### Markdown 文件链接

```text
assistant Markdown
  -> react-markdown URL transform
  -> ChatMessageMarkdown <a>
  -> local resource parser
  -> ChatFileOpenActionViewModel
  -> ChatThreadManager.openFilePreview
  -> workspace file tab
  -> ChatSessionWorkspaceFilePreview
```

第一个错误 hop 是 URL transform / local resource parser：`file:` 在动作产生前已经被拒绝，fragment 也没有进入行列号合同。

补齐 parser 后暴露出的第二个错误 hop 位于预览消费端：workspace 把目标行列号当成 breadcrumb metadata，并用目标行作为整份文本的起始行号。结果既没有导航到目标位置，又破坏了文件的真实行号；大文件仍只读取前 200KB，`#L5713` 还可能根本不在返回窗口内。

### 内联文件展示

```text
assistant nextclaw-inline fenced block
  -> parseChatInlineDisplayDirective
  -> ChatInlineDisplay
  -> NextClaw product renderInlineDisplay
  -> inline placement adapter
  -> ChatSessionWorkspaceFilePreview
  -> server-path read/content
  -> WorkspaceFileContentPreview
```

第一个错误 hop 是产品 `renderInlineDisplay`：parser 已产生合法 file target，但 renderer 返回 `undefined`，导致目标回退为静态占位。

## 核心原则与 Owner

- `information-expert`：`chat-local-resource.utils.ts` 拥有 Markdown 本地资源 URI 的安全转换和文件动作归一化；组件不再重复发明协议判断。
- `single-domain-owner`：文件内容读取、viewer 选择、富内容分发、加载与错误状态继续归 `ChatSessionWorkspaceFilePreview` 及其现有子 renderer。
- `protected-variations`：Markdown link、项目文件树、`show_file`、workspace Tab 与 `nextclaw-inline` 只是入口/placement 变化，不改变文件能力。
- `cqs-pure-read`：预览只读取并展示，不自动调用工具、不修改文件、不注册能力。
- `no-compatibility-by-default`：不保留新旧 parser 或两套 renderer。标准 `file:` URI 是明确支持的外部 Markdown 输入协议，不是事故 fallback；它与普通路径一次性归一化到同一 action。
- `single-fact-owner`：path 是资源身份，line/column 是资源内部位置；breadcrumb 只表达 path，位置只由预览导航状态消费，二者不重复展示或互相改写。

## Markdown 资源合同

### 支持的输入

| 输入 | 处理方式 |
| --- | --- |
| `http:`, `https:` | 外部链接，新窗口打开 |
| `mailto:`, `tel:` | 浏览器原生安全链接 |
| `file:///absolute/path` | 解析为本地文件 action，不让浏览器直接导航 |
| `/absolute/path`, `./relative`, `../relative`, `folder/file`, 裸文件名 | 解析为本地文件 action |
| Windows `C:\\path` / `C:/path` | 解析为本地文件 action |
| `javascript:` 等未知或危险 scheme | 保留禁用 link surface，拒绝执行 |

输入侧接受 `file:` 是为了覆盖标准 URI、历史持久化消息、用户粘贴内容和外部 agent 输出；模型可见回复合同仍优先要求普通 Markdown 路径，避免输出冗长、环境绑定的 URI。这是“宽进、窄出”的公开输入合同，不是静默猜测。

### 文件 URI 约束

- 只接受空 host 或 `localhost`；不把 `file://remote-host/...` 静默解释为本机路径。
- 对 percent-encoded pathname 做一次解码；解码失败时禁用链接。
- Windows drive URI 的 `/C:/...` 归一化为 `C:/...`。
- query 中只读取已存在的 `viewer=source|rendered` 合同。
- fragment 支持 `#L<line>`、`#L<line>C<column>` 和范围形式的起始位置；普通未知 fragment 不伪造行列号。
- scheme-less 路径继续支持现有 `path:line[:column]` 语法。
- 行列号均为从 1 开始的正整数；`L0`、`C0` 和非安全整数不进入内部位置合同。

## 资源位置语义

参考 [VS Code CLI / URL 的 file:line:column 合同](https://code.visualstudio.com/docs/configure/command-line) 与 [浏览器 URI fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment) 的共同语义：位置用于导航到资源内部目标，不是路径的一部分，也不是 breadcrumb 标签。浏览器在资源加载后由客户端解析 fragment 并滚动目标；VS Code 打开文件后把行列转换为编辑器位置。

NextClaw 的单一主链路为：

```text
file URI / local path
  -> parser: { path, line?, column? }
  -> workspace file tab: resource identity + target location
  -> server-path read: return a bounded text window containing target line
  -> code surface: preserve real line numbers, center target, highlight active line/column
```

具体约束：

- tab identity 只由 session、viewer 与 path 决定；同一文件跳到不同位置复用同一 tab，并更新 target location。
- 普通文本窗口从真实 `startLine` 编号；目标行绝不参与内容重编号。
- server-path read 的 line 参数只用于选择读取窗口，不改变资源身份；默认保留目标前若干上下文行，且保证目标行在 200KB 窗口内。目标行不存在时回到文件首段，不伪造命中。
- code surface 在目标内容出现后执行一次视口定位：行居中、整行轻量强调；带 column 时显示列光标并横向带入视口。用户后续手动滚动不会被持续拉回。
- breadcrumb 继续只负责路径浏览；截断状态仍可作为读取状态显示，但 line/column 不再进入 breadcrumb view model。
- 对 Markdown/HTML 等双视图文件，未显式指定 viewer 的行列深链接优先进入 source；显式 `viewer=rendered` 仍按调用者选择执行，不把 rendered 文档伪装成源码定位成功。

### 单一安全转换

`react-markdown` 必须显式使用本地资源 URL transform。这个 transform 是 AST 到 React 元素之间唯一的协议白名单：合法资源原样保留，危险资源变为空字符串。`<a>` 与 `<img>` renderer 只消费转换后的值，不再各自重复一遍安全 resolver。

## 内联文件预览合同

`nextclaw-inline` 的现有 target 形状保持不变：

```json
{
  "target": {
    "type": "file",
    "payload": {
      "path": "/absolute/or/relative/file.html",
      "viewer": "rendered",
      "line": 1,
      "column": 1
    }
  },
  "title": "可选标题"
}
```

文件 target 的内联 placement adapter 只负责三件事：

1. 将 target 映射到现有 `createWorkspaceFileTab` 合同；
2. 提供消息内的固定高度、标题和只读路径；文件预览不展示 descriptor 的 description，也不复用 workspace 的可点击面包屑；
3. 把 session key、project root、working directory 与嵌套文件打开动作交给 `ChatSessionWorkspaceFilePreview`。

它不读取文件、不判断后缀、不选择 renderer、不维护加载状态。因此 inline 和 side panel 不会形成平行实现。

`nextclaw-inline` 仍是声明式展示，不代表“打开侧栏”动作。文件预览内部的媒体控件、滚动以及 Markdown 文档中的正常链接属于内容交互，不把 descriptor 升级为工具执行。

## HTML 行为边界

HTML 文件与 Panel App 仍是两类合同：

- HTML `viewer=rendered` 原样复用现有 workspace iframe 预览，包括已有的页面脚本和内容交互行为；本次不顺手改变其权限模型。
- 内联 file adapter 不提供宿主 bridge、工具权限或 NextClaw runtime 能力；需要宿主能力的应用仍应进入 Panel App 合同。
- HTML iframe 安全策略属于现有 workspace preview 的独立产品合同，应由单独议题评估兼容性和迁移路径，不能借 NC-112 静默收紧并破坏现有 HTML 调试场景。

## 目录与改动边界

- `@nextclaw/agent-chat-ui/chat-local-resource.utils.ts`：统一 URL transform、`file:` / 普通路径解析和行列号提取。
- `ChatMessageMarkdown`：接入唯一 URL transform；链接与图片只消费转换结果。
- `@nextclaw/ui` message feature：新增一个窄的 inline file placement component，复用 workspace file preview。
- `ChatMessageListContainer`：为 file 和 panel app target 选择产品 renderer，不承载文件业务规则。
- `server-path read`：接受可选目标行，返回包含该目标的有界文本窗口与真实 `startLine`；不新增第二个文件读取 API。
- `FileOperationCodeSurface`：在 workspace 变体消费可选 target line/column，负责滚动与当前行视觉状态；compact 工具卡行为保持不变。

不新增 manager、service、registry、server route、私有 URI scheme、工具参数或持久化字段。

## 兼容、取舍与非目标

### 兼容

- 现有普通路径、HTTP 链接、Office 链接、Markdown 图片和 `path:line:column` 行为保持。
- 历史 `file:` 链接变为明确支持，不需要迁移消息数据。
- 现有 `nextclaw-inline` `panel_app`、`url`、`json` 行为保持；只有已经声明支持但未接 renderer 的 file target 获得真实预览。

### 关键取舍

- 不创建 `nextclaw://file`：普通 Markdown 与标准 `file:` 已足够表达，私有 scheme 只会增加模型、parser 和文档负担。
- 不把 inline file 变成自动侧栏动作：声明式展示与命令式打开必须继续分离。
- 不复制 `WorkspaceFileContentPreview` 分发：短期少传几个参数不值得换来两套 viewer 规则和错误状态。
- 不改变 HTML 的既有执行语义：NC-112 只补齐 file target 到统一 preview owner 的缺口，权限收紧必须作为独立兼容议题处理。

### 非目标

- 不实现文件编辑、保存或 HTML 应用 bridge。
- 不支持远程 SMB/UNC `file://host` 读取。
- 不把预览升级成可编辑代码编辑器，不实现选择范围、键盘光标移动、代码折叠或 minimap；只实现深链接所需的一次性行列定位反馈。
- 不改变 `show_file`、`show_panel_app` 与 `ui.show-content` 工具合同。
- 不统一 Panel App inline/side-panel iframe host；它是独立的 runtime 结构议题。

## 验证方案

1. 在 `@nextclaw/agent-chat-ui` 增加 `file:` URI、行列 fragment、危险协议和既有路径回归测试。
2. 在 server-path read 验证大文件目标行窗口：响应返回真实 `startLine`，正文包含目标行，非法/越界行不伪造命中。
3. 在共享 code surface 验证 target 行、列光标、一次性 `scrollIntoView` 与 compact 变体回归。
4. 在 `@nextclaw/ui` 验证 breadcrumb 不再出现 `L12`、文件仍从真实行号编号，并把 target location 交给 workspace code surface。
5. 运行受影响包的 TypeScript、定向 Vitest、ESLint 与 production build。
6. 使用真实本地 HTML 文件和真实聊天页面验证：`#L12C4` 点击后工作区直接定位第 12 行第 4 列；普通图片/PDF/文本与 rendered HTML 仍走原有 preview surface。
7. 运行治理、可维护性 guard 与主观复核，确认没有形成第二套预览链路。
