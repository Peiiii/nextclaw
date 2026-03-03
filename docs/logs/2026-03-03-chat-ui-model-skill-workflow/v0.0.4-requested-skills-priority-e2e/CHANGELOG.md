# v0.0.4 Requested Skills Priority + E2E

## 迭代完成说明

- 修复“已传 requested_skills 但模型无感知”的关键路径问题：
  - 在 `ContextBuilder` 中把 `# Requested Skills` 区块提前到系统提示前部，避免长上下文裁剪时被截断。
  - 增加强约束语义：明确“本轮必须应用用户选择的 skills（除非与更高优先级安全/系统冲突）”。
- 扩展引擎闭环已在 v0.0.3 完成：`codex-sdk` / `claude-agent-sdk` 均支持 `requested_skills` 注入。

## 根因总结

- 之前虽然 native 引擎已透传 `requested_skills`，但该区块位于系统提示后段。
- 在复杂上下文下，输入预算裁剪会截断系统提示尾部，导致模型看不到请求 skill 区块。
