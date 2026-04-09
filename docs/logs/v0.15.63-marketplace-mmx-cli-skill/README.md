# v0.15.63-marketplace-mmx-cli-skill

## 迭代完成说明

- 新增 marketplace skill：[`skills/mmx-cli/SKILL.md`](../../../skills/mmx-cli/SKILL.md)
  - 直接继承上游 [`MiniMax-AI/cli`](https://github.com/MiniMax-AI/cli) 仓库中的 [`skill/SKILL.md`](https://github.com/MiniMax-AI/cli/blob/main/skill/SKILL.md)，未再做 NextClaw 风格重写。
  - 本次仅将上游 skill 内容落入本仓库的 marketplace skill 目录，作为 marketplace 安装载体。
- 新增 marketplace 元数据：[`skills/mmx-cli/marketplace.json`](../../../skills/mmx-cli/marketplace.json)
  - 补齐 marketplace 上架所需的 slug、名称、中英双语 summary / description、标签、作者与来源仓库信息。
- 已通过项目 CLI 将该 skill 首次发布到 NextClaw marketplace，并完成远端查询与非仓库目录安装冒烟闭环。

## 测试 / 验证 / 验收方式

- 上游 skill 逐字一致性校验：

```bash
cmp -s /tmp/minimax-cli/skill/SKILL.md skills/mmx-cli/SKILL.md && echo SKILL_MATCH
```

- 本地 metadata 校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/mmx-cli
```

- 首次上架：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills publish /Users/peiwang/Projects/nextbot/skills/mmx-cli --meta /Users/peiwang/Projects/nextbot/skills/mmx-cli/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

- marketplace 远端校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/mmx-cli
```

观察点：
- 返回 `ok: true`
- `slug = mmx-cli`
- `summaryI18n.en` / `summaryI18n.zh` 存在
- `descriptionI18n.en` / `descriptionI18n.zh` 存在
- `install.kind = marketplace`
- `publishedAt` / `updatedAt = 2026-04-09T11:19:16.826Z`

- marketplace 安装冒烟（非仓库目录）：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-skill.XXXXXX)
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills install mmx-cli --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir/skills/mmx-cli" -maxdepth 2 -type f | sort
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir "$tmp_dir/skills/mmx-cli"
rm -rf "$tmp_dir"
```

- maintainability guard：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard
```

结果说明：
- 上游 `skill/SKILL.md` 与本地 [`skills/mmx-cli/SKILL.md`](../../../skills/mmx-cli/SKILL.md) 逐字一致。
- 本地 metadata 校验通过，`Errors: 0`，`Warnings: 0`。
- `mmx-cli` 已成功发布到 marketplace。
- 远端详情查询返回正常，条目为 `install.kind=marketplace`。
- 非仓库目录安装冒烟成功，安装后 skill 目录仅包含 `SKILL.md` 与 `marketplace.json`，且安装后二次 metadata 校验通过。
- `pnpm lint:maintainability:guard` 未通过，但阻塞项与本次改动无关：
  - 目录预算 warning：`packages/nextclaw-ui/src/components/chat`
  - 治理失败：`packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
  - 相关已存在改动文件：`packages/nextclaw-ui/src/components/chat/chat-page-runtime.test.ts`

- `build / lint / tsc`：
  - 不适用。本次未触达 TypeScript 业务源码、构建产物或类型链路，改动集中在 marketplace skill 内容与元数据。

## 发布 / 部署方式

- 本次已首次上架：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills publish /Users/peiwang/Projects/nextbot/skills/mmx-cli --meta /Users/peiwang/Projects/nextbot/skills/mmx-cli/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

- 当前发布结果：
  - marketplace slug：`mmx-cli`
  - 安装命令：`nextclaw skills install mmx-cli`
  - 远端查询：`https://marketplace-api.nextclaw.io/api/v1/skills/items/mmx-cli`

- 若后续需要更新远端条目，使用：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build skills update /Users/peiwang/Projects/nextbot/skills/mmx-cli --meta /Users/peiwang/Projects/nextbot/skills/mmx-cli/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

## 用户 / 产品视角的验收步骤

1. 在任意 NextClaw workspace 或项目目录执行：

```bash
nextclaw skills install mmx-cli
```

2. 安装后检查本地 skill 目录：
   - 应出现 `skills/mmx-cli/SKILL.md`
   - 应出现 `skills/mmx-cli/marketplace.json`

3. 打开安装后的 `SKILL.md`，确认它就是上游 `MiniMax-AI/cli` 的 skill 内容，而不是 NextClaw 自行改写的一版。

4. 在对话中请求 MiniMax CLI 相关任务，例如：
   - 文本对话
   - 图像、视频、语音、音乐生成
   - 搜索或 quota 查询

5. 验收点：
   - AI 会按上游 skill 说明使用 `mmx` CLI
   - 若本机未安装 `mmx-cli` 或未鉴权，AI 会先引导安装与登录
   - marketplace 安装不会假装已自动安装上游 runtime

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。本次刻意避免重写或二次创作 `SKILL.md`，直接继承上游 skill 内容，只补了 marketplace 必需元数据和发布动作。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。与你后续澄清一致，本次从“本地重写一版 skill”收敛回“直接照搬上游 skill”，减少了不必要的产品层包装和后续维护分叉。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本是。文件数仅最小必要新增一个 skill 目录下的两个文件与一份迭代记录，没有扩散到业务源码目录、测试目录或新的运行时逻辑。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。职责边界保持简单：
  - 上游 `MiniMax-AI/cli` skill 负责 skill 内容本身
  - NextClaw 仅负责 marketplace 包装与分发
  - 未引入额外 helper / service / store / wrapper 层
- 目录结构与文件组织是否满足当前项目治理要求：是。新增内容收敛在 `skills/mmx-cli/`，迭代记录收敛在 [`docs/logs/v0.15.63-marketplace-mmx-cli-skill/README.md`](README.md)。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：不适用。本次未触达业务源码、脚本逻辑或运行链路实现，主要是 skill 文档继承与 marketplace 元数据补齐，因此未单独执行代码级 `post-edit-maintainability-review`。
- 若本次迭代不涉及代码可维护性评估，必须明确写“不适用”并说明理由：不适用。原因同上；本次关注点是“避免本地再创作 skill、减少维护分叉”，而不是代码结构调整。
