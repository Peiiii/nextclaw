# 2026-02-18 Release nextclaw v0.5.4 + @nextclaw/core v0.5.2

## 背景

- 本次发布目标：把 “USAGE 文档驱动 + 内置 skill 常驻 + workspace 模板注入” 的自管理闭环对外发布。

## 发布范围

- `nextclaw@0.5.4`
- `@nextclaw/core@0.5.2`

## 发布流程

```bash
source ~/.nvm/nvm.sh
pnpm release:version
pnpm release:publish
```

## 发布结果

- npm 发布成功：
  - `nextclaw@0.5.4`
  - `@nextclaw/core@0.5.2`
- 自动创建 tags：
  - `nextclaw@0.5.4`
  - `@nextclaw/core@0.5.2`

## 发布后验收

```bash
npm view nextclaw version
npm view @nextclaw/core version
```

期望与实际：
- `nextclaw` => `0.5.4`
- `@nextclaw/core` => `0.5.2`

CLI 冒烟（全局 0.5.4）：

```bash
export NEXTCLAW_HOME=/tmp/nextclaw-global-054-smoke
rm -rf "$NEXTCLAW_HOME"
nextclaw init
nextclaw status --json
```

观察点：
- workspace 下存在 `USAGE.md`
- `skills/nextclaw-self-manage/SKILL.md` 已注入
- `status --json` 正常输出并返回预期退出码

## 备注

- 仅 npm 包发布，不涉及数据库/后端 migration。
- 在本地验收中发现历史全局二进制可能覆盖 `npm exec` 结果；通过升级全局 `nextclaw@0.5.4` 后已恢复一致。
