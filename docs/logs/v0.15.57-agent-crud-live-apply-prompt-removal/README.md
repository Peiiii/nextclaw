# v0.15.57-agent-crud-live-apply-prompt-removal

## 迭代完成说明

- 修正 `nextclaw agents new|update|remove` 的 CLI 语义：不再返回旧的“需重启后生效”字段，也不再在普通输出里提示“重启后才能使用”。
- 同步收敛 Agent 自管理真相源：
  - 更新 [docs/USAGE.md](/Users/peiwang/Projects/nextbot/docs/USAGE.md)，把 Agent CRUD 改成“直接修改后校验，不发明重启步骤”。
  - 执行同步脚本，把作者源 guide 同步到 [packages/nextclaw/resources/USAGE.md](/Users/peiwang/Projects/nextbot/packages/nextclaw/resources/USAGE.md)。
- 清理会误导 AI 搜索结果的残留文案：
  - 更新 [skills/skillhub-guide/SKILL.md](/Users/peiwang/Projects/nextbot/skills/skillhub-guide/SKILL.md)，删除宿主重启类引导，改为“以直接 CLI 验证为准”。
  - 更新 [skills/skillhub-guide/scripts/check-skillhub.sh](/Users/peiwang/Projects/nextbot/skills/skillhub-guide/scripts/check-skillhub.sh) 与 [skills/skillhub-guide/scripts/check-skillhub.ps1](/Users/peiwang/Projects/nextbot/skills/skillhub-guide/scripts/check-skillhub.ps1)，移除相同提示。
- 修正相关历史迭代说明 [docs/logs/v0.15.35-agent-update-command/README.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.15.35-agent-update-command/README.md)，避免后续 repo 搜索继续捞到过期的 Agent 重启口径。

## 测试/验证/验收方式

- CLI 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/agent/agent-commands.test.ts`
  - 结果：通过，4 个测试全部通过。
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 结果：通过。
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：通过；仅有 2 个既有 warning，无新增 error。
- guide 同步：
  - `PATH=/opt/homebrew/bin:$PATH node packages/nextclaw/scripts/sync-usage-resource.mjs`
  - 结果：通过，`docs/USAGE.md` 已同步到 `packages/nextclaw/resources/USAGE.md`。
- 残留搜索：
  - 使用 `rg` 搜索旧重启字段与旧宿主重启提示
  - 结果：Agent CRUD 与 Skillhub 对外误导文案已清除；剩余“需重启”字段仅保留在通用配置热重载实现与其测试中，属于别的问题域，不是本次要删除的 Agent 提示。

## 发布/部署方式

- 本次未执行发布或部署。
- 后续随 `nextclaw` 常规发布流程发布即可。
- 不涉及数据库、migration、远程环境或线上服务部署。

## 用户/产品视角的验收步骤

1. 执行 `nextclaw agents new researcher --json`，确认返回 JSON 只包含结果对象，不再出现旧的“需重启”字段。
2. 执行 `nextclaw agents update researcher --description "负责调研" --json`，确认返回 JSON 仍不包含任何重启提示字段。
3. 若 NextClaw 服务已在运行，直接再次执行 `nextclaw agents list --json` 或刷新 `/agents` 页面，确认新 Agent / 新描述已经可见。
4. 检查 [docs/USAGE.md](/Users/peiwang/Projects/nextbot/docs/USAGE.md) 的 Agent CRUD 章节，确认文档不再要求 `nextclaw restart`。
5. 检查 [skills/skillhub-guide/SKILL.md](/Users/peiwang/Projects/nextbot/skills/skillhub-guide/SKILL.md) 和两个 check 脚本，确认已不再出现宿主重启提示。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 是。本次顺着“代码更少、行为更明确、AI 更不容易被历史残留误导”的方向推进了一小步。
  - 这次优先做的是删减，不是补兼容：直接删掉 CLI 的 `requestRestart` 路径和旧重启字段输出，而不是继续保留旧字段再加解释。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：33 行
  - 删除：80 行
  - 净增：-47 行
- 非测试代码增减报告：
  - 新增：26 行
  - 删除：56 行
  - 净增：-30 行
- 是否已尽最大努力优化可维护性：是。核心修复不是再补一条“其实现在不用重启”的说明，而是直接删除错误契约和错误提示来源。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。CLI 代码、测试和文档都改成单一口径，减少了分叉叙述。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。总代码净减少，且没有新增文件或新抽象层。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。Agent CRUD 重新只负责写配置与返回结果，热应用由既有 config reload 链路负责，没有新增补丁式 adapter。
- 目录结构与文件组织是否满足当前项目治理要求：本次没有新增目录平铺问题。守卫提示的 `packages/nextclaw/src/cli` 目录预算与 `runtime.ts` 文件预算 warning 为既有问题，本次未继续恶化。
- no maintainability findings
- 可维护性总结：这次改动属于典型的“非新增能力修正”，最终做到的是删掉过期语义而不是再叠一层提示，因此净代码量下降且职责更清楚。保留债务仅剩既有 CLI 目录/大文件预算 warning，与本次问题域无直接新增关系。
