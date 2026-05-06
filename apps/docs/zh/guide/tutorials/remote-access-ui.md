# 远程访问 UI 教程

这页帮助你从其他设备打开 NextClaw UI。开始前请先确认本机实例已经可用。

## 前置条件

- 本机 `http://127.0.0.1:55667` 可以打开
- `nextclaw status` 正常
- 你理解远程访问会改变访问边界

## 操作步骤

1. 启用远程访问。
2. 运行远程访问诊断。
3. 从另一台设备打开远程入口。
4. 发送一条测试消息。

```bash
nextclaw remote enable
nextclaw remote doctor
```

## 相关文档

- [远程访问](/zh/guide/remote-access)
- [运行与托管手册](/zh/guide/runtime-hosting)
