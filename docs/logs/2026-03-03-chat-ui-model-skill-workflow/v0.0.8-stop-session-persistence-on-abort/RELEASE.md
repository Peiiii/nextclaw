# v0.0.8 Release

## 发布/部署方式

1. 发布 `@nextclaw/core`（包含 abort 持久化修复）。
2. 发布并部署 `nextclaw`（消费最新 core）。
3. 重启服务。
4. 线上冒烟：发送消息后点击 Stop，确认会话不消失、历史可回刷。

## 变更类型判定

- 后端运行时行为修复；不涉及数据库 migration。
