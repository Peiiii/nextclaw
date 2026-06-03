# read_file 分页读取对齐 OpenCode 实施方案

## 背景

当前 NextClaw 读取较长 `SKILL.md` 时，容易出现模型只看到前半段内容却误以为已经读完的问题。根因不是文件实际读不到，而是现有 `read_file` 没有分页参数和续读合同，同时 NCP 工具结果层还可能把长结果二次压缩。

本方案只做一件事：参考 OpenCode，把 `read_file` 改成明确的按行分页读取合同，避免静默半读。图片、PDF、二进制处理单独另做，不混入本次。

## 目标

- `read_file` 支持 `offset` / `limit` 按行分页读取。
- 分页数值直接对齐 OpenCode，不重新发明阈值。
- 超长文件输出明确告诉模型当前读到哪里、是否还有后续、下一次该用什么 `offset`。
- `SKILL.md` 继续走普通 `read_file`，不新增 `read_skill`。
- 确保 OpenCode 50KB 页在 NCP 模型输入中不会被二次压成 10KB preview。

## 非目标

- 不做图片、PDF、二进制读取处理。
- 不新增资源类型系统。
- 不新增 skill 专用工具。
- 不要求模型每次完整读完整个 skill；只要求遇到续读提示时不能误判为已读完。
- 不改变 `write_file` / `edit_file` / `list_dir` 职责。

## OpenCode 对齐基线

参考实现：`https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/read.ts`

本次直接采用这些常量和语义：

- `DEFAULT_READ_LIMIT = 2000`
- `MAX_LINE_LENGTH = 2000`
- `MAX_LINE_SUFFIX = "... (line truncated to 2000 chars)"`
- `MAX_BYTES = 50 * 1024`
- `MAX_BYTES_LABEL = "50 KB"`
- `offset` 是 1-indexed 行号。
- `limit` 是最大读取行数，默认 2000。
- 单行超过 2000 字符时裁单行并追加 line truncated suffix。
- 单次输出超过 50KB 时停止，并提示 `Use offset=<next> to continue`。
- 如果还有更多行，提示 `Showing lines <start>-<last> of <count>. Use offset=<next> to continue.`
- 文件结束时提示 `End of file - total <count> lines`。

不要改成 0-indexed offset，不要使用自创的 8KB / 240 行阈值。

## 关键补充：NCP 二次截断

只改 `ReadFileTool` 的 50KB cap 还不够。NCP runtime 当前默认：

- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/tool-result/tool-result-content.manager.ts`
- `DEFAULT_MAX_MODEL_VISIBLE_CHARS = 10_000`
- `DEFAULT_MAX_STRING_VALUE_CHARS = 4_000`

如果 `read_file` 返回 50KB，但工具结果层再压成 10KB head/tail，或先被 string value cap 压成 4KB middle-truncated preview，模型仍然看不到完整一页内容。这不是真正对齐 OpenCode。

本次不引入资源类型系统，只做常量对齐：

```ts
const DEFAULT_MAX_MODEL_VISIBLE_CHARS = 60_000;
const DEFAULT_MAX_STRING_VALUE_CHARS = 60_000;
```

理由：

- OpenCode 页上限是 `50 * 1024 = 51200` bytes。
- NextClaw 这里按字符计。
- `60_000` 能容纳 50KB 内容、行号、XML-like envelope 和续读提示。
- `DEFAULT_MAX_STRING_VALUE_CHARS` 也必须同步对齐；否则纯字符串工具结果会先被 4KB string cap 截断。
- 大型 data URL / base64-like payload 仍会在 `redactString` 前置分支中被省略，不因 string cap 提高而直接暴露。
- 这是为了让 OpenCode 50KB 页有效进入模型输入，不是扩大设计范围。

`DEFAULT_MAX_TOOL_MESSAGES_CHARS = 60_000` 暂不改；它控制历史多条工具消息总预算。若后续实测连续多页历史保留不足，再单独讨论。

## 当前相关代码

- `packages/nextclaw-core/src/features/agent/tools/filesystem.tools.ts`
  - `ReadFileTool` 当前只接受 `path`，并直接返回完整 `readFileSync(path, "utf-8")`。
- `packages/nextclaw-core/src/features/agent/services/skill-context.ts`
  - 需要补充：如果读取 `SKILL.md` 返回 `Use offset=... to continue`，不能把当前页当完整 skill。
- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/tool-result/tool-result-content.manager.ts`
  - 需要把默认模型可见文本上限和默认字符串值上限都提到 60K。

## 实现设计

### ReadFileTool 参数

```ts
{
  type: "object",
  properties: {
    path: { type: "string", description: "Path to the file" },
    offset: {
      type: "number",
      description: "The line number to start reading from (1-indexed)"
    },
    limit: {
      type: "number",
      description: "The maximum number of lines to read (defaults to 2000)"
    }
  },
  required: ["path"]
}
```

### ReadFileTool 输出

返回值仍是 `Promise<string>`，不改结构化返回。输出采用 OpenCode 风格：

```text
<path>/absolute/path/SKILL.md</path>
<type>file</type>
<content>

1: first line
2: second line

(Showing lines 1-2000 of 3500. Use offset=2001 to continue.)
</content>
```

到达 50KB 输出上限：

```text
(Output capped at 50 KB. Showing lines 1-317. Use offset=318 to continue.)
```

文件结束：

```text
(End of file - total 317 lines)
```

offset 超出范围时沿用简单错误文本：

```text
Error: Offset 999 is out of range for this file (317 lines)
```

## 实施任务

### Task 1: 增加 ReadFileTool 分页测试

文件：

- `packages/nextclaw-core/src/features/agent/features/tests/filesystem.tool.test.ts`

测试覆盖：

- 2505 行文件默认只返回 1-2000 行，并提示 `Use offset=2001 to continue`。
- `offset: 2001` 返回 2001-2505 行，并提示 `End of file - total 2505 lines`。
- 单行超过 2000 字符时包含 `... (line truncated to 2000 chars)`。
- 大量长行命中 50KB cap 时包含 `Output capped at 50 KB` 和下一次 offset。

### Task 2: 实现 ReadFileTool 分页合同

文件：

- `packages/nextclaw-core/src/features/agent/tools/filesystem.tools.ts`

建议常量：

```ts
const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;
```

建议 helper：

```ts
function readNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}
```

offset / limit 语义保持 OpenCode：

```ts
const offset = readNonNegativeInt(params.offset, 1) || 1;
const limit = readNonNegativeInt(params.limit, DEFAULT_READ_LIMIT) || DEFAULT_READ_LIMIT;
```

### Task 3: 对齐 NCP 工具结果模型可见上限

文件：

- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/tool-result/tool-result-content.manager.ts`

修改：

```ts
const DEFAULT_MAX_MODEL_VISIBLE_CHARS = 60_000;
const DEFAULT_MAX_STRING_VALUE_CHARS = 60_000;
```

不改其他工具结果结构，不增加资源类型判断。

测试文件：

- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/__tests__/utils.test.ts`

新增测试：默认 `ToolResultContentManager` 能完整保留一段接近 50KB 的 `read_file` 输出，并保留 `Use offset=... to continue`。

### Task 4: 补 skill 读取纪律提示

文件：

- `packages/nextclaw-core/src/features/agent/services/skill-context.ts`

在 available skills 读取规则附近补一句：

```ts
"- If a SKILL.md read says `Use offset=... to continue`, continue reading until the relevant trigger, required workflow, constraints, and output requirements are covered.",
```

不要写“必须读完整个 skill”。

### Task 5: 补 prompt 测试

文件：

- `packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`

断言包含：

```ts
expect(prompt).toContain("Use offset=... to continue");
expect(prompt).toContain("relevant trigger, required workflow, constraints, and output requirements");
```

## 验证方案（必须通过）

本方案落地后必须完成以下验证闭环，任一项失败都不能宣称完成：

1. **分页行为验证**
   - 覆盖默认第一页、`offset` 续读、单行 2000 字符 cap、单页 50KB cap。
   - 对应测试文件：`packages/nextclaw-core/src/features/agent/features/tests/filesystem.tool.test.ts`。
2. **skill 续读纪律验证**
   - 系统 prompt 必须包含 `Use offset=... to continue` 的后续读取要求。
   - 对应测试文件：`packages/nextclaw-core/src/features/agent/features/tests/context.test.ts`。
3. **runtime user prompt 回归验证**
   - 文件角色迁移后，runtime user prompt 组装必须保持原行为。
   - 对应测试文件：`packages/nextclaw-core/src/features/agent/features/tests/runtime-user-prompt.test.ts`。
4. **NCP 工具结果可见性验证**
   - 默认 `ToolResultContentManager` 必须完整保留 OpenCode-sized 50KB `read_file` 页，不得压缩成 10KB / 4KB preview。
   - 对应测试文件：`packages/ncp-packages/nextclaw-ncp-agent-runtime/src/__tests__/utils.test.ts`。
5. **类型与 lint 验证**
   - `nextclaw-core` 与 `nextclaw-ncp-agent-runtime` 的 `tsc --noEmit` 必须通过。
   - 两个包的 lint 必须无 error；若存在 warning，必须确认不是本次触达文件引入。
6. **治理与可维护性验证**
   - `pnpm lint:new-code:governance` 必须通过。
   - `pnpm check:governance-backlog-ratchet` 必须通过。
   - maintainability guard 必须通过，且没有结构性 findings。

## 验证命令

```bash
pnpm -C packages/nextclaw-core test src/features/agent/features/tests/filesystem.tool.test.ts src/features/agent/features/tests/context.test.ts src/features/agent/features/tests/runtime-user-prompt.test.ts -- --run
pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test src/__tests__/utils.test.ts -- --run
pnpm -C packages/nextclaw-core exec tsc --noEmit
pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime exec tsc --noEmit
pnpm -C packages/nextclaw-core lint
pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched-files>
```

## 验收标准

1. `read_file({ path })` 对 2505 行文本默认只返回 1-2000 行。
2. 第一页输出明确包含 `Use offset=2001 to continue`。
3. `read_file({ path, offset: 2001 })` 返回 2001-2505 行，并包含 `End of file - total 2505 lines`。
4. 单行超过 2000 字符时，单行被截断并包含 `... (line truncated to 2000 chars)`。
5. 单次输出超过 50KB 时，输出包含 `Output capped at 50 KB` 和下一次 offset。
6. NCP 默认工具结果可见上限能完整保留一页 OpenCode-sized `read_file` 输出，不把 50KB 页二次压成 10KB preview。
7. skill prompt 明确要求遇到 `Use offset=... to continue` 时继续读取到覆盖相关流程与约束。

## 暂不采用

### 不采用：新增 read_skill

当前问题可以由通用文件读取分页解决。新增 skill 专用工具会扩大 owner 和调用面，暂时没有必要。

### 不采用：资源语义分类

`instruction_resource` / `file_page` / `log` 这类分类可能长期有价值，但本次目标只是对齐成熟读取工具的分页合同。现在引入会过度设计。

### 不采用：图片、PDF、二进制处理

OpenCode 对这些类型有额外处理，但它们不是本次 `SKILL.md` 半读问题的根因。后续若要做，单独开一个 `read_file media/binary guard` 方案。

## 后续观察点

如果分页合同落地后，模型仍频繁在 `SKILL.md` 第一页后停止，再基于实际失败证据加强 prompt 或增加 `SKILL.md` 场景测试，不提前造大系统。
