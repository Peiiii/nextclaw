# Browser Connector 结构化交互定位方案

## 背景

2026-06-07 的 Suno 真实会话暴露了一个非视觉浏览器控制缺口：页面文本和截图都能证明页面上有 `Create`，但 `browser-connector` 原有 `page snapshot` 只稳定输出 `links/buttons/inputs` 三类节点，`page click` 又只接受 CSS selector。模型在没有截图能力或不该依赖截图时，只能反复猜 `[data-testid]`、`button[type=submit]`、`[tabindex]` 等 selector。

这不是单纯模型能力问题。若把 Codex 也限制在当前这套粗 snapshot + selector click 合同里，同样会难定位。Codex 内置浏览器能力更顺手的关键在于结构化页面能力：可枚举候选、可复用节点引用、按引用执行动作，而不是靠视觉或猜 CSS。

## 目标

让 `browser-connector` 在不依赖截图/视觉模型的情况下，提供接近 Codex 结构化页面操作的最小能力：

- 模型先拿到可交互候选，而不是从正文文本猜 selector。
- 每个候选有短 ref、selector、文本/aria/placeholder、role/kind、可见/禁用状态和 bounding box。
- 模型能按文本定位候选，并在多个同名候选中消歧。
- `page click` 支持 ref，CSS selector 仍保留为兼容主路径。
- 失败时暴露在候选发现或 ref 过期上，而不是沉默变成空转 selector 猜测。

## 不做什么

- 不把截图/视觉能力作为本次主方案；截图只作为另一路诊断证据。
- 不引入独立 Playwright 浏览器，不绕过用户当前 Chrome/profile。
- 不开放任意页面 `evaluate`。任意 JS 执行会扩大安全面，当前先用专门的 `snapshot/locate/ref click` 合同覆盖定位问题。
- 不在执行层新增网站特定 alias 或 Suno 特判。

## 方案

### 1. Snapshot 增加 `interactive`

`page snapshot --interactive` 返回 `interactive` 数组，候选来源包括：

- 原生交互元素：`a/button/input/textarea/select/summary`。
- ARIA 交互角色：`button/link/menuitem/option/switch/checkbox/radio/tab/textbox/combobox`。
- `onclick`、非负 `tabindex`、`contenteditable`。
- `cursor: pointer` 的可见元素。

每个候选返回：

- `ref`：例如 `i1`，用于后续 ref click。
- `selector`：当前可生成的 CSS selector。
- `text/ariaLabel/placeholder/role/kind/tagName/inputType/href`。
- `visible/disabled/unique`。
- `boundingBox`：只用于结构化消歧，不要求模型具备视觉能力。

### 2. 增加 `page locate`

`page locate --lease <leaseId> --text <text>` 返回匹配文本、aria label、placeholder、role、kind 或 tagName 的可交互候选。

这个命令是只读能力，不需要 `--reason` 或写操作确认。它的作用是让模型在执行点击前先拿到候选集合。

### 3. `page click` 支持 `--ref`

`page click` 从只支持：

```bash
browser-connector page click --lease "<leaseId>" --selector "<selector>" --reason "<why>" --json
```

扩展为 selector/ref 二选一：

```bash
browser-connector page click --lease "<leaseId>" --ref "i2" --reason "<why>" --json
```

ref 在页面 DOM 当前状态下按同一套候选规则重新解析。若页面变化导致 ref 过期，命令应失败并要求重新 snapshot/locate，而不是猜测替代 selector。

## AI 使用顺序

定位复杂元素时默认顺序：

1. `page locate --text "<visible label>"`。
2. 若候选不够，`page snapshot --interactive`。
3. 根据 `role/kind/text/boundingBox/disabled/visible` 消歧。
4. 使用 `page click --ref "<ref>"`。
5. 操作后用 `page wait`、`page snapshot`、URL 或标题变化验证。
6. 只有结构化信息不足时才补 screenshot。

## 验收

代码级验收：

- CLI tests 覆盖 interactive snapshot、locate、click ref 和 click 参数校验。
- `@nextclaw/browser-connector` 类型检查通过。
- extension JS 语法检查通过。
- package build 通过并复制 extension 资源。

真实链路验收：

- 本地或真实 Chrome 在 extension reload 后，`setup chrome --json` 的 capability discovery 能看到 `page.locate`。
- 对 Suno 类页面，AI 能先定位多个 `Create` 候选，再按结构化候选选择目标，而不是反复猜 CSS selector。

## 文档同步

本方案落地时同步更新：

- `docs/plans/2026-06-07-browser-connector-codex-parity-review-plan.md`
- `docs/designs/2026-06-07-browser-connector-real-world-evaluation.md`
- `packages/browser-connector/README.md`
- `skills/browser-control/SKILL.md`
- `docs/logs/<version>-browser-connector-structured-interaction/README.md`
