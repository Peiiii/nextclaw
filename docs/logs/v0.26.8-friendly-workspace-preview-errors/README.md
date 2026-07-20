# v0.26.8 优化工作台文件预览错误提示

## 迭代完成说明

- 会话工作台文件预览不再直接展示服务端原始错误信息。
- `SERVER_PATH_NOT_FOUND` 会映射为友好的“文件可能已移动、重命名或删除”提示。
- 其他预览错误统一使用既有本地化预览失败提示，避免泄露内部诊断文本。
- 保留 Server 既有结构化错误合同；本次仅修正 UI 展示边界，不建立重复错误协议。

## 测试/验证/验收方式

- UI 定向测试覆盖缺失文件与普通内部错误，确认两类错误均映射到正确的本地化文案，且原始诊断不会显示。
- 工作台文件预览组件既有测试全部通过。
- UI TypeScript、ESLint、构建、治理检查与 `git diff --check` 通过。

## 发布/部署方式

- 新增 `.changeset/friendly-workspace-preview-errors.md`，标记 `@nextclaw/ui` patch。
- 本次只提交并尽量 fast-forward 合入本地 `master`；不 push、不建 PR、不发布 NPM 包、不部署、不执行 migration，也不重启现有 NextClaw 实例。

## 用户/产品视角的验收步骤

1. 在会话工作台打开一个随后被移动、重命名或删除的文件。
2. 确认预览区域显示友好的“找不到这个文件”提示，而不是 `server path does not exist`。
3. 切换英文界面，确认显示对应英文提示。
4. 触发其他预览错误，确认界面展示通用本地化失败提示，不暴露内部错误正文。

## 可维护性总结汇总

- 错误识别只依赖 Client SDK 的结构化 `code`，没有通过字符串匹配判断服务端错误。
- 错误到用户文案的映射收敛在工作台文件预览组件边界，Server 和查询层职责保持不变。
- 新增小型专用测试文件，避免继续扩大已接近行数预算的综合组件测试文件。
- 没有新增 fallback、兼容分支、React effect、平行错误协议或重复请求链路。
- Maintainability guard 检查 2 个代码文件：总代码 `+32 / -5 / 净增 27`，非测试代码 `+9 / -5 / 净增 4`；新增量用于结构化错误识别和本地化映射。闸门为 0 error，1 个 warning 是预览组件接近既有 500 行预算。
- 新增代码治理、governance backlog ratchet、generated-clean 与 `git diff --check` 均通过；主观复核结论为 UI 展示 owner 清晰、Server 错误合同未重复、没有字符串匹配或原始错误 fallback。

## NPM 包发布记录

- `@nextclaw/ui`：需要 patch，发布友好的本地化文件预览错误提示，待统一发布。
- Changeset：`.changeset/friendly-workspace-preview-errors.md`。
- 本次未执行 NPM 发布。
