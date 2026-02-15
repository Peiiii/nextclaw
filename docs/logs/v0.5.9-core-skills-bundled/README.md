# 2026-02-15 内置 Skills 打包修复

## 背景 / 问题

- 运行时提示 “skills 目录为空”，导致技能不可用
- 根因：`nextclaw-core` 构建时未将 `src/agent/skills` 复制到 `dist/skills`，且 ContextBuilder 覆盖了默认内置路径

## 决策

- 在 `nextclaw-core` build 流程中复制内置 skills 到 `dist/skills`
- ContextBuilder 使用 SkillsLoader 的默认内置路径
- 运行时继续优先读取 workspace skills，内置 skills 作为默认兜底

## 变更内容

- 新增 `packages/nextclaw-core/scripts/copy-skills.mjs`
- `packages/nextclaw-core/package.json` 的 build 增加复制步骤（复制到 `dist/skills`）
- `packages/nextclaw-core/src/agent/context.ts` 使用默认内置 skills 路径

## 验证（怎么确认符合预期）

```bash
# build / lint / tsc
pnpm build
pnpm lint
pnpm tsc

# smoke-check（非仓库目录）
cd /tmp
PATH="/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH" node --input-type=module -e \
  "import { existsSync, readdirSync } from 'node:fs';\nconst dir='/Users/peiwang/Projects/nextbot/packages/nextclaw-core/dist/skills';\nconst ok=existsSync(dir) && readdirSync(dir).length > 0;\nconsole.log(ok ? 'smoke-ok' : 'smoke-fail');"
```

验收点：

- build/tsc 通过
- lint 通过（若存在 max-lines 警告，记录即可）
- 冒烟输出包含 `smoke-ok`

## 发布 / 部署

- 本次为 core 构建修复；如需发布 npm 包按 `docs/workflows/npm-release-process.md`

## 影响范围 / 风险

- Breaking change：否
- 回滚方式：回退本次提交
