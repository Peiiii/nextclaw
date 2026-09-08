# 故障排查

## 缓存命中率低或模型费用增长快

开发版精简了重复的会话与消息说明，inline 展示时会先读取对应 skill 的完整协议。若观察到少量新增的 skill 读取，这是按需加载的一部分；应比较包含这些读取的完整任务费用，不能只凭系统提示长度或缓存百分比判断收益。

原生会话会保留工具名称与用途，较大的非基础参数通过 `tool_schema` 使用前查询；执行仍做完整参数校验。会话搜索从启动即声明，后台索引未完成时返回明确状态。统一输出上限后的五阶段实验中，21 个样本全部通过，最终版费用比原版低 62.0%、比 DSH 低 10.8%。这些是开发版短任务实测；参数按需加载的普遍无损性、供应商缓存影响及各阶段数据见下方报告。

开发工作区新增了三任务标准基准，涵盖文件核对、配置诊断和代码修复，并与官方 DSH 对照。安装可选 SDK 后运行 `pnpm benchmark:cache run`，默认共享预算 USD 0.05；用 `pnpm benchmark:cache show <report.json>` 查看，用 `pnpm benchmark:cache compare <旧报告> <新报告>` 离线比较。核心指标为三项任务全部缓存输入 / 全部输入，任务失败或用量不全时无效。详细安装、token、耗时和测量结果见[实测报告](/zh/blog/2026-09-08-deepseek-cache-benchmark)。以下是保留的单任务诊断入口，其分数不能直接与三任务分数比较。

会话累计命中率包含首次输入。判断持续任务的成本时，需要一起检查任务是否完成、每次调用的用量和历史是否被改写。Native 会话会保留模型调用的轮次，连续工具结果按发生顺序提供给模型。

从源码仓库可以运行固定的真实任务基准。它使用已配置的 DeepSeek 官方 `deepseek-v4-flash`，在临时工作区连续核对五个文件并回答追问，不使用你的业务文件：

```bash
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash
```

先看一个数：**固定真实任务整体缓存命中率**。它按整个文件任务的缓存输入 token 总和除以输入 token 总和计算，包含首轮和后续追问。只有文件读取、答案和调用次数均通过检查，才作为有效任务结果；不能把某次最高命中率当成整体结果。

测试会产生真实 API 费用。默认每次运行的估算预算为 0.10 美元，最多 18 次请求、每次最多 512 个输出 token，超出预算会在下一次请求前停止。报告默认保存在 NextClaw 数据目录的 `diagnostics/prompt-cache/`，包含黄金指标、逐调用用量、耗时、费用估算和源码指纹。费用使用报告中的价格快照计算，不等于账单实扣；价格变化时用 `--prices <未命中输入价,缓存输入价,输出价>` 指定每百万 token 的美元价格。

保留基线后，可以用同一任务追踪变化：

```bash
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash --output baseline.json
pnpm smoke:prompt-cache -- --transport task-suite --model deepseek/deepseek-v4-flash --baseline baseline.json --output current.json
pnpm smoke:prompt-cache -- --compare baseline.json current.json
```

最后一条只比较已有报告，不调用模型。运行测试时，黄金指标低于 80%、比基线下降超过 5 个百分点、任务未完成、历史被改写或用量缺失都会返回失败；可用 `--min-cache-rate` 调整绝对门槛。短任务的首次输入和新增文件内容也需要计算，不能要求所有任务固定达到 95%。此基准不自动创建定时任务；如需定期运行，重复同一命令并保留报告即可。

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

## 6. Windows 上会话消息暂时无法写入

Windows 可能会短暂占用会话缓存文件，日志中可见 `EPERM`、`EACCES` 或 `EBUSY`。NextClaw 会在有限时间内重试；如果仍无法提交缓存，会继续从会话日志读取消息，因此已经发送或完成的消息不会因缓存写入失败而中断。

缓存恢复后，后续消息更新会自动重建并恢复分页性能。若同一错误持续出现，请关闭正在扫描 NextClaw 数据目录的安全软件或索引工具后重试，并附上相关日志和复现步骤。
