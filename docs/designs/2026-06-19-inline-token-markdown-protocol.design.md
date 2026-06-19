# Inline Token Markdown 协议渲染方案

## 背景

`@panel-app:<id>` 是聊天文本里的轻量协议，和 `$skill` 一样，本质上仍是纯文本。当前实现先在业务适配层用 token 匹配把文本切成 `inline-content`，再交给 UI 渲染。这会绕开 Markdown 语义，导致 `` `@panel-app:xxx` `` 或 fenced code block 里的协议也被展示成特殊 token。

## 核心判断

协议识别可以发生在文本层，但协议展示必须发生在 Markdown AST 层。

依据：

- CommonMark 明确定义 code span 与 fenced code block 是独立语法节点，其内容应按代码文本处理。
- `react-markdown` 已经走 remark/mdast AST 管线；最佳做法是在 mdast 的 `text` node 上做 transform，而不是对原始 markdown 字符串做全局替换。
- `@nextclaw/ui` 不应理解 Markdown 结构；`@nextclaw/agent-chat-ui` 不应理解 Panel App 业务，只接收通用 inline token 数据。

参考：

- CommonMark 0.31.2: https://spec.commonmark.org/0.31.2/
- remark-parse: https://unifiedjs.com/explore/package/remark-parse/
- mdast: https://github.com/syntax-tree/mdast

## 方案

把消息文本主链路改成：

```text
NextClaw message adapter
  -> markdown part { text, inlineTokens }
  -> ChatMessageMarkdown
  -> remark inline-token plugin
  -> only replace mdast text nodes
  -> leave code / inlineCode nodes literal
```

职责边界：

- `packages/nextclaw-ui`：从 metadata 和纯文本协议里解析出通用 `ChatInlineTokenSource`，并附到 markdown part。
- `packages/nextclaw-agent-chat-ui`：在 Markdown AST 渲染阶段把 text node 中的 token rawText 渲染为 badge。
- `ChatInlineTokenViewModel`：只包含 `kind/key/label/rawText`，不包含业务 metadata、resolver 或函数。

## 非目标

- 不新增 Panel App metadata 协议。
- 不改变用户发送出去的纯文本内容。
- 不设计新的 Markdown 语法扩展。
- 不用 micromark 自定义 tokenizer；当前只需要渲染层 transform，完整语法扩展复杂度过高。

## 验收标准

- 普通文本里的 `@panel-app:<id>` 仍展示为 Panel App inline token。
- inline code 里的 `@panel-app:<id>` 保持代码文本，不展示 badge。
- fenced code block 里的 `@panel-app:<id>` 保持代码文本，不展示 badge。
- `$skill` metadata token 仍能展示为 skill inline token。
- 消息适配层不再把普通文本切成 `inline-content`。
- 类型检查、定向测试、治理检查通过。
