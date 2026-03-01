# Release

## 发布/部署方式

本次涉及 QQ 运行时发送策略与内置 skill 变更，按常规 NPM 发布流程执行：

```bash
pnpm changeset
pnpm release:version
pnpm release:publish
```

详细流程见：[docs/workflows/npm-release-process.md](docs/workflows/npm-release-process.md)。

## 发布闭环说明

- 代码变更：已完成（QQ 纯文本发送 + qq-url-guard skill）。
- 构建验证：见 [VALIDATION.md](docs/logs/2026-03-01-qq-url-guard-skill/v0.0.1-qq-url-guard-skill/VALIDATION.md)。
- 发布动作：按需执行上述命令。

## 不适用项

- 远程 migration：不适用（无后端/数据库变更）。
- 线上关键 API 冒烟：不适用（本次为渠道发送策略与 skill 规则变更）。
