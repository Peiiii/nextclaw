# Logs

- `docs/logs/v0.4.2-remove-guide-links/README.md`
- `docs/logs/v0.4.9-init-command/README.md`
- `docs/logs/v0.4.8-template-files/README.md`
- `docs/logs/v0.4.6-ui-api-base-dynamic/README.md`
- `docs/logs/v0.4.7-port-availability-fix/README.md`
- `docs/logs/v0.4.5-cli-runtime-refactor/README.md`
- `docs/logs/v0.4.1-dev-start-ports/README.md`
- `docs/logs/v0.4.0-channel-guides/README.md`
- `docs/logs/v0.3.9-ui-model-examples/README.md`
- `docs/logs/v0.3.8-frontend-release/README.md`
- `docs/logs/v0.3.7-readme-docs/README.md`
- `docs/logs/v0.3.6-commands-doc-cleanup/README.md`
- `docs/logs/v0.3.5-service-manager/README.md`
- `docs/logs/v0.3.4-start-frontend-optin/README.md`
- `docs/logs/v0.3.3-readme-english/README.md`
- `docs/logs/v0.3.2-readme-user/README.md`
- `docs/logs/v0.2.9-logo-refresh/README.md`
- `docs/logs/v0.0.1-mvp/README.md`
- `docs/logs/v0.0.1-ts-port-complete/README.md`
- `docs/logs/v0.0.1-dev-cli-shortcut/README.md`
- `docs/logs/v0.0.1-remove-nanobot-legacy/README.md`
- `docs/logs/v0.1.0-headless/README.md`

## 写日志的标准

每次改动完成后新增一篇日志文件，至少包含：

- 做了什么（用户可见 + 关键实现点）
- 怎么验证（轻量 smoke-check + `build/lint/typecheck`）
- 怎么发布/部署（如果会影响 npm 包/线上环境；详细流程引用 `docs/workflows/npm-release-process.md`）

模板：`docs/logs/TEMPLATE.md`

## 规划规则

- 规划文档禁止写具体花费时间/工期（例如“3 天”“1 周”）；只写里程碑顺序、交付物与验收标准。
- 规划类文档建议以 `.plan.md` 结尾（例如 `YYYY-MM-DD-xxx.plan.md`），便于区分“规划”与“实现/复盘”
