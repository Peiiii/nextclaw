# v0.20.19-read-file-pagination-opencode-alignment

## 迭代完成说明

本轮完成 `read_file` 文本读取合同的 OpenCode 风格分页对齐，避免长 `SKILL.md` 或长文本文件被模型半读后误判为已读完。

根因：

- `ReadFileTool` 旧实现只接受 `path`，直接返回完整文件内容，没有 `offset` / `limit` 分页参数，也没有续读提示。
- NCP tool result 层默认 `10_000` 字符模型可见上限和 `4_000` 字符 string value 上限，会把 50KB 级文本页二次压缩成 preview。

修复：

- `ReadFileTool` 增加 1-indexed `offset` 与 `limit` 参数。
- 文本分页常量直接对齐 OpenCode：默认 2000 行、单行 2000 字符、单次输出 50KB。
- 输出加入行号、结束提示、50KB cap 提示和 `Use offset=<next> to continue` 续读合同。
- NCP tool result 默认模型可见文本上限和字符串值上限同步调到 `60_000`，确保 OpenCode-sized 50KB 页不会被二次压缩。
- skill 读取提示补充：`SKILL.md` 返回续读提示时，必须继续读到覆盖相关触发条件、流程、约束和输出要求。
- 治理触达后顺手把 `skill-context.ts` 与 `runtime-user-prompt.ts` 迁移到真实 `utils` 角色路径，删除不符合角色后缀的旧位置。

## 测试/验证/验收方式

验证结论：通过。本轮把验证方案作为完成门槛：分页行为、skill 续读纪律、runtime user prompt 回归、NCP 50KB 工具结果可见性、类型检查、lint、治理和可维护性检查全部通过后才收尾。

- `pnpm -C packages/nextclaw-core test src/features/agent/features/tests/filesystem.tool.test.ts src/features/agent/features/tests/context.test.ts src/features/agent/features/tests/runtime-user-prompt.test.ts -- --run`
  - 结果：通过，3 个测试文件、15 个测试通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime test src/__tests__/utils.test.ts -- --run`
  - 结果：通过，1 个测试文件、7 个测试通过。
- `pnpm -C packages/nextclaw-core exec tsc --noEmit`
  - 结果：通过。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime exec tsc --noEmit`
  - 结果：通过。
- `pnpm -C packages/nextclaw-core lint`
  - 结果：通过，无 error；仍有既有 warning。
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime lint`
  - 结果：通过。
- Targeted ESLint：
  - `pnpm -C packages/nextclaw-core exec eslint ...`
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime exec eslint ...`
  - 结果：均通过。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：通过，无 errors / warnings。

## 发布/部署方式

本轮未执行发布或部署。改动属于源码能力与测试更新，后续随常规版本发布进入包产物。

## 用户/产品视角的验收步骤

1. 让 agent 使用 `read_file` 读取超过 2000 行的文本文件。
2. 第一页应只展示 1-2000 行，并提示 `Use offset=2001 to continue`。
3. 再以 `offset=2001` 读取，应继续返回后续行，而不是重复第一页。
4. 读取超过 50KB 的文本页时，应提示 `Output capped at 50 KB` 和下一次 offset。
5. 读取长 `SKILL.md` 时，如果返回续读提示，agent 应继续读取到覆盖相关流程与约束后再执行。

## 可维护性总结汇总

- 本轮没有引入新工具类型、`read_skill` 专用入口或资源分类系统，保持在现有 `ReadFileTool` owner 内实现分页合同。
- 通过治理暴露的旧命名债务已顺手减债：`skill-context.ts` 与 `runtime-user-prompt.ts` 从错误角色目录迁移到 `utils` 路径。
- `post-edit-maintainability-guard` 通过，无新增结构性 findings。
- 本轮属于 agent 工具可运行能力增强，因此存在必要非测试代码净增；新增代码主要用于分页合同、续读提示和可见性 cap 对齐测试，不是平行实现。

## NPM 包发布记录

不涉及 NPM 包发布。
