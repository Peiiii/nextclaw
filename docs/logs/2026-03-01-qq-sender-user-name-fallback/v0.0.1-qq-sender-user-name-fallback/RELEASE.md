# Release

## 发布/部署方式

本次为 QQ 渠道昵称提取兼容修复，按常规 NPM 发布流程执行：

```bash
pnpm changeset
pnpm release:version
pnpm release:publish
```

详细流程见：[docs/workflows/npm-release-process.md](docs/workflows/npm-release-process.md)。

## 发布闭环说明

- 代码变更：已完成（`sender.user_name` 字段兼容）。
- 构建验证：见 [VALIDATION.md](docs/logs/2026-03-01-qq-sender-user-name-fallback/v0.0.1-qq-sender-user-name-fallback/VALIDATION.md)。
- 发布动作：按需执行上述命令。

## 不适用项

- 远程 migration：不适用。
- 线上关键 API 冒烟：不适用（渠道入站解析逻辑变更）。
