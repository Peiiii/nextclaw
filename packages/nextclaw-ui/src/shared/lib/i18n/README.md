# i18n owner

This directory temporarily keeps domain label owner modules next to the i18n runtime entrypoint.

## 目录预算豁免

- 原因：i18n 文案正在从单一超大 `index.ts` 逐步拆到领域 owner 文件，当前新增 cron 文案先落到独立 owner，避免继续膨胀入口文件；后续应迁移为每个语言独立 JSON，由 runtime 统一加载。
