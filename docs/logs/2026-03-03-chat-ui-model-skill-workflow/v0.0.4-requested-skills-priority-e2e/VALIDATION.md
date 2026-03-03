# v0.0.4 Validation

## 执行命令（关键）

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`

## E2E 冒烟（真实链路）

- 方式：创建临时测试 skill `skill-marker`，其规则为“本轮回复必须以前缀 `[[SKILL_MARKER_ACTIVE]]` 开头”。
- 对照请求：
  - 不传 `metadata.requested_skills`
  - 传 `metadata.requested_skills=["skill-marker"]`

## 结果

- 不传 skill：回复 `OK`。
- 传 `skill-marker`：回复 `[[SKILL_MARKER_ACTIVE]] skill-marker`（成功感知并执行）。

## 结论

- `requested_skills` 已完成端到端生效验证（UI/API/runtime/model 生效）。
