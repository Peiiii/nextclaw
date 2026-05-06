# 运行自动化

自动化让 NextClaw 不只在你发消息时响应，也能按计划主动做事。

第一次使用自动化时，先从低风险提醒开始，不要直接做高影响任务。

## 适合自动化的任务

- 每天提醒你确认最重要任务
- 固定时间生成日报草稿
- 周期性汇总某个项目状态
- 在指定时间继续一个会话

## 推荐第一步

创建一个简单提醒：

```text
每天上午 9:30 提醒我确认今天最重要的一件事。
```

确认它能按预期触发之后，再增加复杂任务。

## 自动化和会话

如果任务需要延续上下文，可以绑定会话。  
如果任务应该独立运行，就让它使用自己的自动化会话。

## 命令入口

常用操作包括：

```bash
nextclaw cron list
nextclaw cron add
nextclaw cron run <jobId>
nextclaw cron disable <jobId>
```

完整参数见 [命令索引](/zh/guide/commands)。

## 相关文档

- [第一个有用工作流](/zh/guide/after-setup)
- [对话与会话](/zh/guide/chat)
- [运行与托管](/zh/guide/runtime-hosting)
