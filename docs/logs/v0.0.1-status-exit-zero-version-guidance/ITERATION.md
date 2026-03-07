# Iteration v0.0.1-status-exit-zero-version-guidance

## 迭代完成说明

- 调整 `nextclaw status` / `nextclaw status --json` 的命令契约：只要成功生成状态结果，进程退出码固定为 `0`；运行态好坏改由返回体中的 `level` 字段表达。
- 保留 `doctor` 作为严格诊断命令，便于脚本或自动化流程继续通过退出码判定失败。
- 补充版本查询规范：明确“查看当前版本”必须使用 `nextclaw --version`，不得用 `status` 代替。
- 更新自管理技能与文档提示，避免 AI 将版本查询误映射到 `nextclaw status --json`。
- 新增一条 CLI 回归测试，覆盖 stopped 状态下 `status --json` 仍返回成功退出码的行为。

## 测试/验证/验收方式

- 单测：`pnpm -C packages/nextclaw test -- diagnostics.status.test.ts`
- 构建：`pnpm build`
- 代码检查：`pnpm lint`
- 类型检查：`pnpm tsc`
- CLI 冒烟：在非仓库目录执行 `nextclaw status --json`，确认有 JSON 输出且 shell 退出码为 `0`；执行 `nextclaw --version`，确认直接返回版本号。

## 发布/部署方式

- 本次为 CLI 与文档修正；若需要发版，按现有 NPM 流程执行 `changeset -> version -> publish`。
- 如仅本地验证，无需额外部署动作。
- 若后续正式发布，需同步确认 `nextclaw` 包内模板 `USAGE.md` 与 docs 站点内容一致。

## 用户/产品视角的验收步骤

1. 在终端执行 `nextclaw status --json`。
2. 观察命令输出为合法 JSON；即使 `level` 为 `stopped`，命令本身也不显示失败。
3. 紧接着执行 `echo $?`，确认退出码为 `0`。
4. 执行 `nextclaw --version`，确认直接返回当前安装版本，而不是运行状态信息。
5. 向 AI 发送“查看 nextclaw 当前版本”，确认它优先选择 `nextclaw --version`。
