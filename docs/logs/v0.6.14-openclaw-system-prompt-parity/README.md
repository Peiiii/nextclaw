# 2026-02-19 OpenClaw system prompt parity (core prompt text)

## 背景 / 问题

- 用户要求：NextClaw 的系统提示词除项目特有信息外，其他部分要与 OpenClaw 保持一致，减少行为偏差与踩坑。
- 现状：`nextclaw-core` 的系统提示词此前在结构与文案上与 OpenClaw 存在差异（章节顺序、术语、规范句式不一致）。

## 决策

- 对齐目标：以 OpenClaw 当前系统提示词为基线，统一核心章节与规范句式。
- 保留差异：仅保留 NextClaw 特有内容（工具名、CLI 命令、工作目录、Self-Management 路径）。
- 不做本次范围：不引入新的回复策略引擎，不改变 `NO_REPLY` 判定代码逻辑。

## 变更内容

- `packages/nextclaw-core/src/agent/context.ts`
  - 重写 `getIdentity()` 生成模板，按 OpenClaw 主体结构对齐：
    - Tooling / Tool Call Style / Safety / CLI Quick Reference / Workspace / Reply Tags / Messaging / Memory Recall / Silent Replies / Heartbeats / Runtime。
  - 文案层面与 OpenClaw保持同语义、同规则表达；仅替换 NextClaw 项目专有名词与路径。
  - `message tool hints` 继续保留注入能力，但挂接到 OpenClaw 风格的 `### message tool` 段落中。
  - `buildSystemPrompt()` 对齐 OpenClaw 的上下文拼装风格：
    - 将 `# Workspace Context` 收敛为 `# Project Context`，并补充 SOUL 提示语句；
    - 增加 `## Skills (mandatory)` 指引与 `<available_skills>` 块；
    - 移除旧的分隔符拼接（`---`），改为 OpenClaw 风格的连续段落拼装。

## 保留差异（判定为 NextClaw 特有能力）

- 保留 `nextclaw` CLI 子命令与 `USAGE.md` 自管理指引（OpenClaw 对应路径/命令不同）。
- 保留 NextClaw 实际工具集合命名（如 `read_file`/`write_file`/`list_dir`）。
- 未引入 OpenClaw 中依赖其运行时能力的专属段落（如 sandbox/browser/nodes/session_status/model alias 等）。

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc
```

验收点：

- `build/lint/tsc` 全部通过。
- 启动网关后，系统提示词章节顺序与 OpenClaw 基线一致（除 NextClaw 专有项）。
- `NO_REPLY`、Reply Tags、Messaging 指引文案与 OpenClaw 语义一致。

## 发布 / 部署

- 本次是提示词文本对齐，不涉及数据库或后端迁移。
- 若后续需要发布 npm 包，按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- 影响范围：仅提示词文本。
- 风险：模型行为会随提示词更贴近 OpenClaw 习惯，属于预期变化。
- Breaking change：否。
