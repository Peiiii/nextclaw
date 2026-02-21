# v0.6.43-update-version-change-prompt

## 迭代完成说明（改了什么）

本次迭代完善了 `nextclaw update` 的版本可观测性：

1. CLI `update` 命令新增版本变化提示
- 更新前输出当前版本：`Current version: x.y.z`
- 更新成功后输出版本结果：
  - 版本变化：`Version updated: x.y.z -> a.b.c`
  - 版本未变：`Version unchanged: x.y.z`

2. Gateway 更新工具补齐版本变化结构化结果
- `gateway` 工具动作 `update.run` 返回中新增：
  - `version.before`
  - `version.after`
  - `version.changed`

3. 使用文档补齐
- `docs/USAGE.md` 的 Self-update 章节补充版本变化提示说明。
- 同步到模板文档 `packages/nextclaw/templates/USAGE.md`。

## 测试 / 验证 / 验收方式

### 工程验证

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`

### 冒烟验证（真实命令）

- 命令：

```bash
NEXTCLAW_UPDATE_COMMAND='echo smoke-update-ok' pnpm -C packages/nextclaw dev:build update --timeout 60000
```

- 观察点：
  - 命令先输出 `Current version: ...`
  - 成功后输出 `Version updated: ... -> ...` 或 `Version unchanged: ...`

### 用户/产品视角验收步骤

1. 用户执行 `nextclaw update`。
2. 在终端确认能看到更新前版本（Current version）。
3. 在终端确认能看到更新结果对应的版本变化提示（updated/unchanged）。
4. 若通过 AI 触发 `gateway update.run`，确认返回中包含 `version.before/after/changed` 字段。

验收通过标准：用户无需猜测是否更新成功，能直接从输出判断版本变化结果。

## 发布 / 部署方式

- 已执行发布闭环：
  1. `pnpm changeset version`
  2. `pnpm release:check`
  3. `pnpm changeset publish`
  4. `pnpm changeset tag`
- 已发布版本：`nextclaw@0.6.25`
- 部署方式：升级到 `nextclaw@0.6.25` 后重启服务即可生效。
