# 用户消息换行修复与 beta 发布

## 迭代完成说明

- 状态：修复已验证并合入远端主干，beta NPM 包已写入并核验 27/27，发行 Git 状态、真实安装和 Runtime 流程继续处理中。用户授权合入主干并触发 beta 发布。
- 根因：编辑器将换行保留为 `\n`，发送 envelope、文本 part 和消息 view model 保留正文内部换行；共享 Markdown 渲染没有将用户消息中的软换行转为可见断行。
- 修复：在共享 `ChatMessageMarkdown` 的现有插件链中，仅对用户消息启用 `remark-breaks`。没有改写发送内容或持久化格式，历史消息重载时同样生效。
- 本任务全部 7 个草稿路径从主工作区迁入 `codex/user-message-line-breaks`；逐项核对后只撤回源区对应增量，保留其它任务的 Bibo 和文档 WIP。

## 测试/验证/验收方式

- 修前复现 5 个失败用例，覆盖 LF、CRLF、CR、格式化文本及列表内换行。
- 修后 Markdown 与流式稳定性定向回归共 67 项通过；换行专题拆分后 6 项重新通过。匹配范围 `tsc`、定向 ESLint、治理和 diff-only maintainability 检查通过。
- 当前源码真实页面发送三行文字后，浏览器测得文字纵坐标分别为 86.5、111.9453125、137.390625；刷新已保存会话后结果一致。
- 测试实例供应商返回 403，因此不宣称成功验证 AI 回复。该错误不阻断用户消息发送、保存及换行展示的证据。

## 发布/部署方式

- 精确提交本任务文件后普通推送 `origin/master`，执行 `pnpm release:reconcile:mainline` 保护活跃 WIP。
- 从冻结远程主干执行现有 `pnpm release:beta`；默认公共包 beta 批次，包含 `nextclaw` 时闭合 beta Runtime 更新通道。桌面安装包和正式版发布不属于本次范围。
- 发布身份、workflow 和终态在下方追加；尚未发布的内容不预填成功。
- 修复提交为 `32a38da67d711ee7659f40380d3a473b035ec190`，已推送 `origin/master`。主工作区保留活跃文档 WIP，reconcile 返回 `LOCAL_WORKTREE_RETRYING` 并复用已有自动 worker。
- 首轮发布写入成功，但 registry 可见性核验耗尽默认重试：`@nextclaw/remote`、`@nextclaw/ui`、`nextclaw` 暂时缺失。对照普通和带新查询的公开 metadata，三个包先后变得可见；扩大现有核验入口的等待参数后，同一 checkpoint 达到 27/27。没有重复 publish、增加版本或改写发布校验脚本。
- 此次恢复暂计 `AUTOMATION_INTERVENTIONS: 1`，介入点为首轮核验失败后的同批次恢复；根因为 registry 可见性传播晚于默认等待窗口。没有证据需要新增全局规则；后续可在原发布 owner 评估等待窗口，不能将本次单例写成缓存故障。

## 用户/产品视角的验收步骤

1. 在聊天输入框用 Shift + Enter 输入三行文字后发送，用户消息应显示三行，无需行尾空格或反斜杠。
2. 刷新或重新打开会话，消息仍保留断行。
3. Markdown 硬换行不重复断行；代码块、公式和引用保留原有功能。

## 可维护性总结汇总

- 复用一个共享展示 owner 和现有 Markdown 插件链，生产代码新增 2 行，无平行组件或数据转换链。
- 原 Markdown 测试文件接近预算，新用例落入独立的换行专题测试文件，原测试文件保持不变。
- 维护性检查无错误；已有目录预算豁免与展示文件接近预算的 warning 未扩展为无关重构。轻量人工复核未发现缺陷，未触发完整主观复核。
- 新路径 planned-path preflight 和治理检查通过。

## NPM 包发布记录

- 需要 beta 发布：这是用户可见的消息展示 bugfix，且用户已明确授权。
- 明确触达 `@nextclaw/agent-chat-ui`，产品包 `nextclaw` 及依赖闭包由默认发布入口判定。
- checkpoint：`e34ea5f53d41aaad`；当前 `nextclaw@0.59.0-beta.1`，`@nextclaw/agent-chat-ui@0.12.4-beta.0`。公开 metadata 和同一 checkpoint 的 27/27 精确版本核验通过，真实安装与 Runtime 状态待补。
- 本批 registry 已发布包：`@nextclaw/agent-chat-ui@0.12.4-beta.0`、`@nextclaw/feishu-core@0.3.14-beta.0`、`@nextclaw/ncp-agent-runtime@0.4.28-beta.0`、`@nextclaw/ncp-agent-runtime-next@0.1.30-beta.0`、`@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http@0.3.31-beta.0`、`@nextclaw/core@0.18.6-beta.0`、`@nextclaw/channel-extension-dingtalk@0.2.55-beta.0`、`@nextclaw/channel-extension-discord@0.2.55-beta.0`、`@nextclaw/channel-extension-email@0.2.55-beta.0`、`@nextclaw/channel-extension-slack@0.2.55-beta.0`、`@nextclaw/channel-extension-telegram@0.2.55-beta.0`、`@nextclaw/channel-extension-wecom@0.2.55-beta.0`、`@nextclaw/channel-extension-whatsapp@0.2.55-beta.0`、`@nextclaw/mcp@0.3.56-beta.0`、`@nextclaw/ncp-mcp@0.2.56-beta.0`、`@nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.56-beta.0`、`@nextclaw/nextclaw-narp-runtime-opencode@0.2.56-beta.0`、`@nextclaw/runtime@0.4.55-beta.0`、`@nextclaw/kernel@0.19.2-beta.1`、`@nextclaw/harness@0.2.28-beta.1`、`@nextclaw/server@0.23.14-beta.1`、`@nextclaw/client-sdk@0.12.14-beta.1`、`@nextclaw/companion@0.2.71-beta.1`、`@nextclaw/remote@0.3.71-beta.1`、`@nextclaw/service@0.7.8-beta.1`、`@nextclaw/ui@0.27.5-beta.1`、`nextclaw@0.59.0-beta.1`。
