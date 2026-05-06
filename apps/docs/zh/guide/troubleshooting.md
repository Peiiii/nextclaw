# 故障排查

排错页用于恢复问题，不是学习主路径。遇到异常时，先按下面顺序缩小范围。

## 1. 服务是否在运行

```bash
nextclaw status
nextclaw doctor
```

如果服务没有运行，先执行：

```bash
nextclaw start
```

如果状态异常，再尝试：

```bash
nextclaw restart
```

## 2. UI 打不开

检查：

- 地址是否是 `http://127.0.0.1:55667`
- 服务是否真的已启动
- 端口是否被占用
- 日志里是否有启动错误

## 3. 模型没有回复

检查：

- provider 是否保存成功
- API Key 或登录状态是否有效
- 默认模型是否存在
- 当前网络是否能访问 provider

## 4. 渠道连不上

检查：

- token 是否过期
- 渠道权限是否完整
- 平台回调或网络是否可达
- `nextclaw channels status` 是否显示异常

## 5. 自动化没有触发

检查：

- job 是否启用
- 时间表达是否符合预期
- 服务是否在计划触发时运行
- 任务是否绑定了错误的会话

## 常用诊断命令

```bash
nextclaw status --verbose
nextclaw doctor --verbose
nextclaw service autostart doctor
nextclaw remote doctor
```

## 仍然无法定位

带着下面信息再反馈问题：

- NextClaw 版本
- 操作系统
- 安装方式
- `nextclaw status` 输出
- `nextclaw doctor` 输出
- 复现步骤
