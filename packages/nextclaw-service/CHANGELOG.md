# @nextclaw/service

## 0.3.45-beta.0

### Patch Changes

- 5b07b81: Add automatic Windows Desktop host-exit diagnostics, including local crash evidence, restart recovery records, and AI-readable incident reporting.
- 70dd515: Add the experimental `@nextclaw/harness` SDK with Agent, Session, Run, and Contribution APIs; expose lifecycle-scoped tools, context, model providers, runtimes, and MCP capabilities; and add the non-interactive `nextclaw exec` command for headless tasks.
- f9c6477: 修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
- Updated dependencies [2c7ce8c]
- Updated dependencies [5b07b81]
- Updated dependencies [eeac1f6]
- Updated dependencies [5f68b2f]
- Updated dependencies [41cb756]
- Updated dependencies [037d93e]
- Updated dependencies [ec60bc1]
- Updated dependencies [70dd515]
- Updated dependencies [3817714]
- Updated dependencies [f9c6477]
- Updated dependencies [83c0628]
  - @nextclaw/kernel@0.10.0-beta.0
  - @nextclaw/ncp@0.9.0-beta.0
  - @nextclaw/core@0.17.7-beta.0
  - @nextclaw/server@0.18.0-beta.0
  - @nextclaw/runtime@0.4.33-beta.0
  - @nextclaw/shared@0.4.27-beta.0
  - @nextclaw/remote@0.3.42-beta.0
  - @nextclaw/channel-extension-dingtalk@0.2.33-beta.0
  - @nextclaw/channel-extension-discord@0.2.33-beta.0
  - @nextclaw/channel-extension-email@0.2.33-beta.0
  - @nextclaw/channel-extension-feishu@0.2.28-beta.0
  - @nextclaw/channel-extension-qq@0.2.27-beta.0
  - @nextclaw/channel-extension-slack@0.2.33-beta.0
  - @nextclaw/channel-extension-telegram@0.2.33-beta.0
  - @nextclaw/channel-extension-wecom@0.2.33-beta.0
  - @nextclaw/channel-extension-weixin@0.2.28-beta.0
  - @nextclaw/channel-extension-whatsapp@0.2.33-beta.0
  - @nextclaw/ncp-agent-runtime@0.4.20-beta.0
  - @nextclaw/ncp-mcp@0.2.34-beta.0
  - @nextclaw/ncp-toolkit@0.6.22-beta.0
  - @nextclaw/client-sdk@0.7.4-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.20-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.21-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.34-beta.0
  - @nextclaw/mcp@0.3.34-beta.0

## 0.3.44

### Patch Changes

- Updated dependencies [9816eaf]
  - @nextclaw/kernel@0.9.2
  - @nextclaw/server@0.17.3
  - @nextclaw/remote@0.3.41
  - @nextclaw/client-sdk@0.7.3

## 0.3.43

### Patch Changes

- Updated dependencies [82e8b03]
  - @nextclaw/server@0.17.2
  - @nextclaw/client-sdk@0.7.2
  - @nextclaw/remote@0.3.40

## 0.3.42

### Patch Changes

- 6587602: 新增默认关闭的产品活跃统计与隐私设置：未登录安装使用随机匿名标识，登录后按账号归并，并可将团队和 QA 测试流量从外部 DAU、WAU、MAU 中分开。
- Updated dependencies [1d63057]
- Updated dependencies [3e6da7e]
- Updated dependencies [6587602]
- Updated dependencies [0f0753a]
- Updated dependencies [7cc703c]
  - @nextclaw/server@0.17.1
  - @nextclaw/kernel@0.9.1
  - @nextclaw/client-sdk@0.7.1
  - @nextclaw/core@0.17.6
  - @nextclaw/ncp@0.8.1
  - @nextclaw/ncp-toolkit@0.6.21
  - @nextclaw/remote@0.3.39
  - @nextclaw/channel-extension-dingtalk@0.2.32
  - @nextclaw/channel-extension-discord@0.2.32
  - @nextclaw/channel-extension-email@0.2.32
  - @nextclaw/channel-extension-slack@0.2.32
  - @nextclaw/channel-extension-telegram@0.2.32
  - @nextclaw/channel-extension-wecom@0.2.32
  - @nextclaw/channel-extension-whatsapp@0.2.32
  - @nextclaw/mcp@0.3.33
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.33
  - @nextclaw/runtime@0.4.32
  - @nextclaw/channel-extension-feishu@0.2.27
  - @nextclaw/channel-extension-weixin@0.2.27
  - @nextclaw/ncp-agent-runtime@0.4.19
  - @nextclaw/ncp-mcp@0.2.33
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.19
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.20
  - @nextclaw/shared@0.4.26
  - @nextclaw/channel-extension-qq@0.2.26

## 0.3.41

### Patch Changes

- c10dcaa: 新增统一的结构化运行诊断事件、安全错误分类和日志查询命令，覆盖 Service、扩展、配置、渠道、Agent、全部 kernel 工具、外部 transport 与定时任务关键链路；取消、网络与未知异常都有独立可查询终态。内置 AI 现在可以按时间窗和关联 ID 从日志证据排查运行故障。QQ 渠道首先接入完整投递链路，并默认不记录消息正文、工具参数/结果、完整 URL、用户身份或凭据。
- Updated dependencies [c19ae8f]
- Updated dependencies [e8d725a]
- Updated dependencies [256e2cb]
- Updated dependencies [c10dcaa]
  - @nextclaw/kernel@0.9.0
  - @nextclaw/server@0.17.0
  - @nextclaw/client-sdk@0.7.0
  - @nextclaw/channel-extension-qq@0.2.25
  - @nextclaw/shared@0.4.25
  - @nextclaw/core@0.17.5
  - @nextclaw/remote@0.3.38
  - @nextclaw/channel-extension-dingtalk@0.2.31
  - @nextclaw/channel-extension-discord@0.2.31
  - @nextclaw/channel-extension-email@0.2.31
  - @nextclaw/channel-extension-feishu@0.2.26
  - @nextclaw/channel-extension-slack@0.2.31
  - @nextclaw/channel-extension-telegram@0.2.31
  - @nextclaw/channel-extension-wecom@0.2.31
  - @nextclaw/channel-extension-weixin@0.2.26
  - @nextclaw/channel-extension-whatsapp@0.2.31
  - @nextclaw/mcp@0.3.32
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.32
  - @nextclaw/runtime@0.4.31
  - @nextclaw/ncp-mcp@0.2.32

## 0.3.40

### Patch Changes

- Updated dependencies [ae676ff]
  - @nextclaw/kernel@0.8.7
  - @nextclaw/remote@0.3.37
  - @nextclaw/server@0.16.7
  - @nextclaw/client-sdk@0.6.7

## 0.3.39

### Patch Changes

- @nextclaw/kernel@0.8.6
- @nextclaw/remote@0.3.36
- @nextclaw/server@0.16.6
- @nextclaw/client-sdk@0.6.6

## 0.3.38

### Patch Changes

- Updated dependencies [7da88a5]
- Updated dependencies [ef5d9ae]
- Updated dependencies [1df4217]
- Updated dependencies [65dc8fb]
  - @nextclaw/server@0.16.5
  - @nextclaw/core@0.17.4
  - @nextclaw/kernel@0.8.5
  - @nextclaw/client-sdk@0.6.5
  - @nextclaw/remote@0.3.35
  - @nextclaw/channel-extension-dingtalk@0.2.30
  - @nextclaw/channel-extension-discord@0.2.30
  - @nextclaw/channel-extension-email@0.2.30
  - @nextclaw/channel-extension-slack@0.2.30
  - @nextclaw/channel-extension-telegram@0.2.30
  - @nextclaw/channel-extension-wecom@0.2.30
  - @nextclaw/channel-extension-whatsapp@0.2.30
  - @nextclaw/mcp@0.3.31
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.31
  - @nextclaw/runtime@0.4.30
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.19
  - @nextclaw/ncp-mcp@0.2.31

## 0.3.37

### Patch Changes

- Updated dependencies [80f7660]
  - @nextclaw/core@0.17.3
  - @nextclaw/channel-extension-dingtalk@0.2.29
  - @nextclaw/channel-extension-discord@0.2.29
  - @nextclaw/channel-extension-email@0.2.29
  - @nextclaw/channel-extension-slack@0.2.29
  - @nextclaw/channel-extension-telegram@0.2.29
  - @nextclaw/channel-extension-wecom@0.2.29
  - @nextclaw/channel-extension-whatsapp@0.2.29
  - @nextclaw/kernel@0.8.4
  - @nextclaw/mcp@0.3.30
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.30
  - @nextclaw/remote@0.3.34
  - @nextclaw/runtime@0.4.29
  - @nextclaw/server@0.16.4
  - @nextclaw/ncp-mcp@0.2.30
  - @nextclaw/client-sdk@0.6.4

## 0.3.36

### Patch Changes

- Updated dependencies [56ab5c2]
  - @nextclaw/core@0.17.2
  - @nextclaw/kernel@0.8.3
  - @nextclaw/channel-extension-dingtalk@0.2.28
  - @nextclaw/channel-extension-discord@0.2.28
  - @nextclaw/channel-extension-email@0.2.28
  - @nextclaw/channel-extension-slack@0.2.28
  - @nextclaw/channel-extension-telegram@0.2.28
  - @nextclaw/channel-extension-wecom@0.2.28
  - @nextclaw/channel-extension-whatsapp@0.2.28
  - @nextclaw/mcp@0.3.29
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.29
  - @nextclaw/remote@0.3.33
  - @nextclaw/runtime@0.4.28
  - @nextclaw/server@0.16.3
  - @nextclaw/ncp-mcp@0.2.29
  - @nextclaw/client-sdk@0.6.3

## 0.3.35

### Patch Changes

- ebbe1e0: 优化交互式 CLI 的连续输入体验：Agent 或工具仍在运行时可以继续提交消息；同一会话会按输入顺序处理，不必等上一轮回复结束后再输入。
- Updated dependencies
- Updated dependencies [aa08a3f]
- Updated dependencies [e2a7c8e]
- Updated dependencies [004d51f]
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.18
  - @nextclaw/ncp@0.8.0
  - @nextclaw/ncp-toolkit@0.6.20
  - @nextclaw/ncp-agent-runtime@0.4.18
  - @nextclaw/core@0.17.1
  - @nextclaw/kernel@0.8.2
  - @nextclaw/server@0.16.2
  - @nextclaw/client-sdk@0.6.2
  - @nextclaw/channel-extension-feishu@0.2.25
  - @nextclaw/channel-extension-weixin@0.2.25
  - @nextclaw/ncp-mcp@0.2.28
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.28
  - @nextclaw/shared@0.4.24
  - @nextclaw/channel-extension-dingtalk@0.2.27
  - @nextclaw/channel-extension-discord@0.2.27
  - @nextclaw/channel-extension-email@0.2.27
  - @nextclaw/channel-extension-slack@0.2.27
  - @nextclaw/channel-extension-telegram@0.2.27
  - @nextclaw/channel-extension-wecom@0.2.27
  - @nextclaw/channel-extension-whatsapp@0.2.27
  - @nextclaw/mcp@0.3.28
  - @nextclaw/remote@0.3.32
  - @nextclaw/runtime@0.4.27
  - @nextclaw/channel-extension-qq@0.2.24

## 0.3.34

### Patch Changes

- Updated dependencies [27d7293]
  - @nextclaw/kernel@0.8.1
  - @nextclaw/server@0.16.1
  - @nextclaw/client-sdk@0.6.1
  - @nextclaw/remote@0.3.31

## 0.3.33

### Patch Changes

- 9c3069d: 修复页面更新后 Agent 与 CLI 仍可能进入旧版 runtime 的问题。launcher 元数据现在只在启动边界消费一次，更新后的页面、Agent shell、服务重启与新开的 `nextclaw` 命令会统一使用当前 runtime。

## 0.3.32

### Patch Changes

- Updated dependencies [ca2c98d]
  - @nextclaw/kernel@0.8.0
  - @nextclaw/server@0.16.0
  - @nextclaw/client-sdk@0.6.0
  - @nextclaw/core@0.17.0
  - @nextclaw/remote@0.3.30
  - @nextclaw/channel-extension-dingtalk@0.2.26
  - @nextclaw/channel-extension-discord@0.2.26
  - @nextclaw/channel-extension-email@0.2.26
  - @nextclaw/channel-extension-slack@0.2.26
  - @nextclaw/channel-extension-telegram@0.2.26
  - @nextclaw/channel-extension-wecom@0.2.26
  - @nextclaw/channel-extension-whatsapp@0.2.26
  - @nextclaw/mcp@0.3.27
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.27
  - @nextclaw/runtime@0.4.26
  - @nextclaw/ncp-mcp@0.2.27

## 0.3.31

### Patch Changes

- Updated dependencies [298233c]
  - @nextclaw/kernel@0.7.0
  - @nextclaw/remote@0.3.29
  - @nextclaw/server@0.15.29
  - @nextclaw/client-sdk@0.5.29

## 0.3.30

### Patch Changes

- Updated dependencies [4be6947]
- Updated dependencies [237a931]
  - @nextclaw/kernel@0.6.28
  - @nextclaw/server@0.15.28
  - @nextclaw/core@0.16.0
  - @nextclaw/remote@0.3.28
  - @nextclaw/client-sdk@0.5.28
  - @nextclaw/channel-extension-dingtalk@0.2.25
  - @nextclaw/channel-extension-discord@0.2.25
  - @nextclaw/channel-extension-email@0.2.25
  - @nextclaw/channel-extension-slack@0.2.25
  - @nextclaw/channel-extension-telegram@0.2.25
  - @nextclaw/channel-extension-wecom@0.2.25
  - @nextclaw/channel-extension-whatsapp@0.2.25
  - @nextclaw/mcp@0.3.26
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.26
  - @nextclaw/runtime@0.4.25
  - @nextclaw/ncp-mcp@0.2.26

## 0.3.29

### Patch Changes

- Updated dependencies
- Updated dependencies [2542896]
  - @nextclaw/mcp@0.3.25
  - @nextclaw/kernel@0.6.27
  - @nextclaw/ncp-mcp@0.2.25
  - @nextclaw/server@0.15.27
  - @nextclaw/remote@0.3.27
  - @nextclaw/client-sdk@0.5.27

## 0.3.28

### Patch Changes

- 83c1949: Keep in-app runtime updates restartable on existing Linux systemd installations, including legacy units that still use `Restart=on-failure`.

## 0.3.27

### Patch Changes

- Updated dependencies [9b22a7d]
- Updated dependencies [efb52a7]
  - @nextclaw/shared@0.4.23
  - @nextclaw/kernel@0.6.26
  - @nextclaw/server@0.15.26
  - @nextclaw/client-sdk@0.5.26
  - @nextclaw/core@0.15.24
  - @nextclaw/remote@0.3.26
  - @nextclaw/channel-extension-dingtalk@0.2.24
  - @nextclaw/channel-extension-discord@0.2.24
  - @nextclaw/channel-extension-email@0.2.24
  - @nextclaw/channel-extension-slack@0.2.24
  - @nextclaw/channel-extension-telegram@0.2.24
  - @nextclaw/channel-extension-wecom@0.2.24
  - @nextclaw/channel-extension-whatsapp@0.2.24
  - @nextclaw/mcp@0.3.24
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.25
  - @nextclaw/runtime@0.4.24
  - @nextclaw/channel-extension-feishu@0.2.24
  - @nextclaw/channel-extension-qq@0.2.23
  - @nextclaw/channel-extension-weixin@0.2.24
  - @nextclaw/ncp-mcp@0.2.24

## 0.3.26

### Patch Changes

- fb73f89: 改进 Marketplace 技能更新：检测到安装后的本地修改时返回明确冲突，并在用户确认后才覆盖更新；取消操作会保留现有技能文件。
- 33eb6b2: 修复设置页更新后仍由 systemd 拉起旧运行时的问题。更新现在保持一键完成，并在切换运行时后由稳定 launcher 重新拉起新版本，页面版本、内核版本和实际进程保持一致。
- 6b3127f: 新增完整的 Apps 与 Mini App 体验：可从内置市场发现、安装、启用、更新、回滚和卸载组合应用，并首发由待办、Markdown 笔记、收藏与日历组成的“个人空间”。应用代码按版本不可变安装，个人数据保存在稳定目录；安装事务、包完整性、运行时授权清理、远程下载预算与日历订阅网络边界也得到强化。
- Updated dependencies [fb73f89]
- Updated dependencies [7179c7a]
- Updated dependencies [6b3127f]
  - @nextclaw/server@0.15.25
  - @nextclaw/kernel@0.6.25
  - @nextclaw/shared@0.4.22
  - @nextclaw/client-sdk@0.5.25
  - @nextclaw/remote@0.3.25
  - @nextclaw/core@0.15.23
  - @nextclaw/channel-extension-dingtalk@0.2.23
  - @nextclaw/channel-extension-discord@0.2.23
  - @nextclaw/channel-extension-email@0.2.23
  - @nextclaw/channel-extension-slack@0.2.23
  - @nextclaw/channel-extension-telegram@0.2.23
  - @nextclaw/channel-extension-wecom@0.2.23
  - @nextclaw/channel-extension-whatsapp@0.2.23
  - @nextclaw/mcp@0.3.23
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.24
  - @nextclaw/runtime@0.4.23
  - @nextclaw/channel-extension-feishu@0.2.23
  - @nextclaw/channel-extension-qq@0.2.22
  - @nextclaw/channel-extension-weixin@0.2.23
  - @nextclaw/ncp-mcp@0.2.23

## 0.3.25

### Patch Changes

- 7786bdf: 移除无法可靠完成会话恢复的 agent `gateway.restart` 能力；需要重启时，现在统一提示用户在外部终端运行顶层 `nextclaw restart`，并明确 `nextclaw gateway` 仅用于启动前台 gateway、不提供生命周期子命令。
- Updated dependencies [ffb365c]
- Updated dependencies [c783019]
- Updated dependencies [0b7df97]
- Updated dependencies [7786bdf]
  - @nextclaw/server@0.15.24
  - @nextclaw/client-sdk@0.5.24
  - @nextclaw/core@0.15.22
  - @nextclaw/kernel@0.6.24
  - @nextclaw/ncp@0.7.17
  - @nextclaw/remote@0.3.24
  - @nextclaw/channel-extension-dingtalk@0.2.22
  - @nextclaw/channel-extension-discord@0.2.22
  - @nextclaw/channel-extension-email@0.2.22
  - @nextclaw/channel-extension-slack@0.2.22
  - @nextclaw/channel-extension-telegram@0.2.22
  - @nextclaw/channel-extension-wecom@0.2.22
  - @nextclaw/channel-extension-whatsapp@0.2.22
  - @nextclaw/mcp@0.3.22
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.23
  - @nextclaw/runtime@0.4.22
  - @nextclaw/channel-extension-feishu@0.2.22
  - @nextclaw/channel-extension-weixin@0.2.22
  - @nextclaw/ncp-agent-runtime@0.4.17
  - @nextclaw/ncp-mcp@0.2.22
  - @nextclaw/ncp-toolkit@0.6.19
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.17
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.17
  - @nextclaw/shared@0.4.21
  - @nextclaw/channel-extension-qq@0.2.21

## 0.3.24

### Patch Changes

- 4ab158d: 渠道扩展改为按需启动：未启用渠道不再常驻独立 Node 进程，运行中启用或禁用渠道会自动创建或回收对应扩展；同时增加 ready/generation 隔离、鉴权会话租约、有限故障恢复和扩展进程内存诊断。

  在 ARM64 Linux、2 vCPU / 2 GiB 限制和无活跃任务的空配置基准中，三轮平均 working set 从旧版本约 865～885 MiB 降至 164.94 MiB，下降约 81%。活跃 Agent runtime、浏览器、MCP、本地模型和已启用渠道仍会按实际工作增加内存占用。

- Updated dependencies [4ab158d]
- Updated dependencies [c54a1d9]
  - @nextclaw/kernel@0.6.23
  - @nextclaw/server@0.15.23
  - @nextclaw/shared@0.4.20
  - @nextclaw/channel-extension-dingtalk@0.2.21
  - @nextclaw/channel-extension-discord@0.2.21
  - @nextclaw/channel-extension-email@0.2.21
  - @nextclaw/channel-extension-feishu@0.2.21
  - @nextclaw/channel-extension-qq@0.2.20
  - @nextclaw/channel-extension-slack@0.2.21
  - @nextclaw/channel-extension-telegram@0.2.21
  - @nextclaw/channel-extension-wecom@0.2.21
  - @nextclaw/channel-extension-weixin@0.2.21
  - @nextclaw/channel-extension-whatsapp@0.2.21
  - @nextclaw/remote@0.3.23
  - @nextclaw/client-sdk@0.5.23
  - @nextclaw/core@0.15.21
  - @nextclaw/mcp@0.3.21
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.22
  - @nextclaw/runtime@0.4.21
  - @nextclaw/ncp-mcp@0.2.21

## 0.3.23

### Patch Changes

- Updated dependencies [c3eb33c]
- Updated dependencies [8049f49]
- Updated dependencies [ae21568]
- Updated dependencies [38e3e98]
- Updated dependencies [db9cab7]
- Updated dependencies [b507e1c]
- Updated dependencies [98c5b7f]
- Updated dependencies [e309470]
- Updated dependencies [31d5655]
- Updated dependencies [8e53d92]
- Updated dependencies [bf3ff68]
- Updated dependencies [071c144]
- Updated dependencies [08325d3]
  - @nextclaw/core@0.15.20
  - @nextclaw/kernel@0.6.22
  - @nextclaw/shared@0.4.19
  - @nextclaw/server@0.15.22
  - @nextclaw/client-sdk@0.5.22
  - @nextclaw/ncp-toolkit@0.6.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.21
  - @nextclaw/ncp@0.7.16
  - @nextclaw/runtime@0.4.20
  - @nextclaw/channel-extension-dingtalk@0.2.20
  - @nextclaw/channel-extension-discord@0.2.20
  - @nextclaw/channel-extension-email@0.2.20
  - @nextclaw/channel-extension-slack@0.2.20
  - @nextclaw/channel-extension-telegram@0.2.20
  - @nextclaw/channel-extension-wecom@0.2.20
  - @nextclaw/channel-extension-whatsapp@0.2.20
  - @nextclaw/mcp@0.3.20
  - @nextclaw/remote@0.3.22
  - @nextclaw/channel-extension-feishu@0.2.20
  - @nextclaw/channel-extension-weixin@0.2.20
  - @nextclaw/ncp-agent-runtime@0.4.16
  - @nextclaw/ncp-mcp@0.2.20
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.16
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.16
  - @nextclaw/channel-extension-qq@0.2.19

## 0.3.22

### Patch Changes

- 817f30a: Make fresh installs truly ready to use: initialize the packaged workspace templates correctly and tell users that the built-in OpenCode Zen model can be used without an API key.

## 0.3.21

### Patch Changes

- 43b0e1d: 让全新安装的 NextClaw 默认接入 OpenCode Zen 当前可调用的七个免费试用模型，无需填写 API Key 即可在模型选择器中直接选择并开始聊天；已有其他提供商配置保持不变，已失效的 Ling 免费模型会从 OpenCode 配置中移除，并明确提示公共网关的限额、模型变化与数据隐私边界。
- Updated dependencies [dbececb]
- Updated dependencies [43b0e1d]
- Updated dependencies [14f321a]
  - @nextclaw/shared@0.4.18
  - @nextclaw/core@0.15.19
  - @nextclaw/ncp-toolkit@0.6.17
  - @nextclaw/kernel@0.6.21
  - @nextclaw/runtime@0.4.19
  - @nextclaw/server@0.15.21
  - @nextclaw/client-sdk@0.5.21
  - @nextclaw/channel-extension-dingtalk@0.2.19
  - @nextclaw/channel-extension-discord@0.2.19
  - @nextclaw/channel-extension-email@0.2.19
  - @nextclaw/channel-extension-slack@0.2.19
  - @nextclaw/channel-extension-telegram@0.2.19
  - @nextclaw/channel-extension-wecom@0.2.19
  - @nextclaw/channel-extension-whatsapp@0.2.19
  - @nextclaw/mcp@0.3.19
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.20
  - @nextclaw/remote@0.3.21
  - @nextclaw/channel-extension-feishu@0.2.19
  - @nextclaw/channel-extension-weixin@0.2.19
  - @nextclaw/channel-extension-qq@0.2.18
  - @nextclaw/ncp-mcp@0.2.19

## 0.3.20

### Patch Changes

- Updated dependencies [5b9dbcd]
  - @nextclaw/shared@0.4.17
  - @nextclaw/kernel@0.6.20
  - @nextclaw/server@0.15.20
  - @nextclaw/client-sdk@0.5.20
  - @nextclaw/core@0.15.18
  - @nextclaw/remote@0.3.20
  - @nextclaw/channel-extension-dingtalk@0.2.18
  - @nextclaw/channel-extension-discord@0.2.18
  - @nextclaw/channel-extension-email@0.2.18
  - @nextclaw/channel-extension-slack@0.2.18
  - @nextclaw/channel-extension-telegram@0.2.18
  - @nextclaw/channel-extension-wecom@0.2.18
  - @nextclaw/channel-extension-whatsapp@0.2.18
  - @nextclaw/mcp@0.3.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.19
  - @nextclaw/runtime@0.4.18
  - @nextclaw/channel-extension-feishu@0.2.18
  - @nextclaw/channel-extension-qq@0.2.17
  - @nextclaw/channel-extension-weixin@0.2.18
  - @nextclaw/ncp-mcp@0.2.18

## 0.3.19

### Patch Changes

- 7c293d1: 强化 workspace skill 卸载目标校验，只允许卸载由 Marketplace 管理的直属 skill 目录。
- Updated dependencies
- Updated dependencies [d80eeb2]
- Updated dependencies [215a61f]
  - @nextclaw/channel-extension-dingtalk@0.2.17
  - @nextclaw/channel-extension-discord@0.2.17
  - @nextclaw/channel-extension-email@0.2.17
  - @nextclaw/channel-extension-feishu@0.2.17
  - @nextclaw/channel-extension-qq@0.2.16
  - @nextclaw/channel-extension-slack@0.2.17
  - @nextclaw/channel-extension-telegram@0.2.17
  - @nextclaw/channel-extension-wecom@0.2.17
  - @nextclaw/channel-extension-weixin@0.2.17
  - @nextclaw/channel-extension-whatsapp@0.2.17
  - @nextclaw/client-sdk@0.5.19
  - @nextclaw/core@0.15.17
  - @nextclaw/mcp@0.3.17
  - @nextclaw/ncp-agent-runtime@0.4.15
  - @nextclaw/ncp-mcp@0.2.17
  - @nextclaw/ncp-toolkit@0.6.16
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.15
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.15
  - @nextclaw/remote@0.3.19
  - @nextclaw/runtime@0.4.17
  - @nextclaw/ncp@0.7.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.18
  - @nextclaw/server@0.15.19
  - @nextclaw/shared@0.4.16
  - @nextclaw/kernel@0.6.19

## 0.3.18

### Patch Changes

- c35189d: Codex 和 Claude Code agent runtime 现在会保留各自原生系统提示词，并默认追加 NextClaw 产品指令、工作区上下文与 skill 信息；可通过 `nextclaw agents runtime config` 按 runtime 关闭或恢复注入。
- Updated dependencies [c35189d]
- Updated dependencies
- Updated dependencies [77208ed]
- Updated dependencies [5476d85]
  - @nextclaw/ncp@0.7.14
  - @nextclaw/core@0.15.16
  - @nextclaw/kernel@0.6.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.17
  - @nextclaw/channel-extension-dingtalk@0.2.16
  - @nextclaw/channel-extension-discord@0.2.16
  - @nextclaw/channel-extension-email@0.2.16
  - @nextclaw/channel-extension-feishu@0.2.16
  - @nextclaw/channel-extension-qq@0.2.15
  - @nextclaw/channel-extension-slack@0.2.16
  - @nextclaw/channel-extension-telegram@0.2.16
  - @nextclaw/channel-extension-wecom@0.2.16
  - @nextclaw/channel-extension-weixin@0.2.16
  - @nextclaw/channel-extension-whatsapp@0.2.16
  - @nextclaw/client-sdk@0.5.18
  - @nextclaw/mcp@0.3.16
  - @nextclaw/ncp-agent-runtime@0.4.14
  - @nextclaw/ncp-mcp@0.2.16
  - @nextclaw/ncp-toolkit@0.6.15
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.14
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.14
  - @nextclaw/remote@0.3.18
  - @nextclaw/runtime@0.4.16
  - @nextclaw/shared@0.4.15
  - @nextclaw/server@0.15.18

## 0.3.17

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
- Updated dependencies [9ec5ea2]
  - @nextclaw/channel-extension-dingtalk@0.2.15
  - @nextclaw/channel-extension-discord@0.2.15
  - @nextclaw/channel-extension-email@0.2.15
  - @nextclaw/channel-extension-feishu@0.2.15
  - @nextclaw/channel-extension-qq@0.2.14
  - @nextclaw/channel-extension-slack@0.2.15
  - @nextclaw/channel-extension-telegram@0.2.15
  - @nextclaw/channel-extension-wecom@0.2.15
  - @nextclaw/channel-extension-weixin@0.2.15
  - @nextclaw/channel-extension-whatsapp@0.2.15
  - @nextclaw/client-sdk@0.5.17
  - @nextclaw/core@0.15.15
  - @nextclaw/kernel@0.6.17
  - @nextclaw/mcp@0.3.15
  - @nextclaw/ncp@0.7.13
  - @nextclaw/ncp-agent-runtime@0.4.13
  - @nextclaw/ncp-mcp@0.2.15
  - @nextclaw/ncp-toolkit@0.6.14
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.13
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.13
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.16
  - @nextclaw/remote@0.3.17
  - @nextclaw/runtime@0.4.15
  - @nextclaw/shared@0.4.14
  - @nextclaw/server@0.15.17

## 0.3.16

### Patch Changes

- 6b84324: Remote access now keeps disconnect and recovery diagnostics, correlates local and relay connection events, detects heartbeat loss, and automatically retries temporary connector-offline pages.
- Updated dependencies
- Updated dependencies [6b84324]
  - @nextclaw/channel-extension-dingtalk@0.2.14
  - @nextclaw/channel-extension-discord@0.2.14
  - @nextclaw/channel-extension-email@0.2.14
  - @nextclaw/channel-extension-feishu@0.2.14
  - @nextclaw/channel-extension-qq@0.2.13
  - @nextclaw/channel-extension-slack@0.2.14
  - @nextclaw/channel-extension-telegram@0.2.14
  - @nextclaw/channel-extension-wecom@0.2.14
  - @nextclaw/channel-extension-weixin@0.2.14
  - @nextclaw/channel-extension-whatsapp@0.2.14
  - @nextclaw/client-sdk@0.5.16
  - @nextclaw/core@0.15.14
  - @nextclaw/kernel@0.6.16
  - @nextclaw/mcp@0.3.14
  - @nextclaw/ncp@0.7.12
  - @nextclaw/ncp-agent-runtime@0.4.12
  - @nextclaw/ncp-mcp@0.2.14
  - @nextclaw/ncp-toolkit@0.6.13
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.12
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.15
  - @nextclaw/runtime@0.4.14
  - @nextclaw/shared@0.4.13
  - @nextclaw/remote@0.3.16
  - @nextclaw/server@0.15.16

## 0.3.15

### Patch Changes

- 517e816: Remote 连接异常断开后会从基础延迟重新连接，不再因历史失败累计而长时间显示 offline；多个本地进程同时运行时，状态页也会以真正持有 Remote 的服务为准。
- Updated dependencies
- Updated dependencies [80eda82]
- Updated dependencies [517e816]
- Updated dependencies [e9d49c0]
  - @nextclaw/channel-extension-dingtalk@0.2.13
  - @nextclaw/channel-extension-discord@0.2.13
  - @nextclaw/channel-extension-email@0.2.13
  - @nextclaw/channel-extension-feishu@0.2.13
  - @nextclaw/channel-extension-qq@0.2.12
  - @nextclaw/channel-extension-slack@0.2.13
  - @nextclaw/channel-extension-telegram@0.2.13
  - @nextclaw/channel-extension-wecom@0.2.13
  - @nextclaw/channel-extension-weixin@0.2.13
  - @nextclaw/channel-extension-whatsapp@0.2.13
  - @nextclaw/core@0.15.13
  - @nextclaw/mcp@0.3.13
  - @nextclaw/ncp@0.7.11
  - @nextclaw/ncp-agent-runtime@0.4.11
  - @nextclaw/ncp-mcp@0.2.13
  - @nextclaw/ncp-toolkit@0.6.12
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.14
  - @nextclaw/runtime@0.4.13
  - @nextclaw/kernel@0.6.15
  - @nextclaw/shared@0.4.12
  - @nextclaw/remote@0.3.15
  - @nextclaw/client-sdk@0.5.15
  - @nextclaw/server@0.15.15

## 0.3.14

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.2.12
  - @nextclaw/channel-extension-discord@0.2.12
  - @nextclaw/channel-extension-email@0.2.12
  - @nextclaw/channel-extension-feishu@0.2.12
  - @nextclaw/channel-extension-qq@0.2.11
  - @nextclaw/channel-extension-slack@0.2.12
  - @nextclaw/channel-extension-telegram@0.2.12
  - @nextclaw/channel-extension-wecom@0.2.12
  - @nextclaw/channel-extension-weixin@0.2.12
  - @nextclaw/channel-extension-whatsapp@0.2.12
  - @nextclaw/client-sdk@0.5.14
  - @nextclaw/core@0.15.12
  - @nextclaw/kernel@0.6.14
  - @nextclaw/mcp@0.3.12
  - @nextclaw/ncp@0.7.10
  - @nextclaw/ncp-agent-runtime@0.4.10
  - @nextclaw/ncp-mcp@0.2.12
  - @nextclaw/ncp-toolkit@0.6.11
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.13
  - @nextclaw/remote@0.3.14
  - @nextclaw/runtime@0.4.12
  - @nextclaw/server@0.15.14
  - @nextclaw/shared@0.4.11

## 0.3.13

### Patch Changes

- 0e6075f: Marketplace 技能安装现在会在镜像单文件下载超时时自动切换备用源，并在完整下载后原子替换目标目录，避免安装或更新失败留下半套技能。
- Updated dependencies [a7b66d2]
- Updated dependencies [36c5362]
- Updated dependencies
- Updated dependencies [d116010]
- Updated dependencies [e8118cf]
  - @nextclaw/server@0.15.13
  - @nextclaw/client-sdk@0.5.13
  - @nextclaw/ncp@0.7.9
  - @nextclaw/kernel@0.6.13
  - @nextclaw/channel-extension-dingtalk@0.2.11
  - @nextclaw/channel-extension-discord@0.2.11
  - @nextclaw/channel-extension-email@0.2.11
  - @nextclaw/channel-extension-feishu@0.2.11
  - @nextclaw/channel-extension-qq@0.2.10
  - @nextclaw/channel-extension-slack@0.2.11
  - @nextclaw/channel-extension-telegram@0.2.11
  - @nextclaw/channel-extension-wecom@0.2.11
  - @nextclaw/channel-extension-weixin@0.2.11
  - @nextclaw/channel-extension-whatsapp@0.2.11
  - @nextclaw/core@0.15.11
  - @nextclaw/mcp@0.3.11
  - @nextclaw/ncp-agent-runtime@0.4.9
  - @nextclaw/ncp-mcp@0.2.11
  - @nextclaw/ncp-toolkit@0.6.10
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.12
  - @nextclaw/runtime@0.4.11
  - @nextclaw/shared@0.4.10
  - @nextclaw/remote@0.3.13

## 0.3.12

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.2.10
  - @nextclaw/channel-extension-discord@0.2.10
  - @nextclaw/channel-extension-email@0.2.10
  - @nextclaw/channel-extension-feishu@0.2.10
  - @nextclaw/channel-extension-qq@0.2.9
  - @nextclaw/channel-extension-slack@0.2.10
  - @nextclaw/channel-extension-telegram@0.2.10
  - @nextclaw/channel-extension-wecom@0.2.10
  - @nextclaw/channel-extension-weixin@0.2.10
  - @nextclaw/channel-extension-whatsapp@0.2.10
  - @nextclaw/client-sdk@0.5.12
  - @nextclaw/core@0.15.10
  - @nextclaw/kernel@0.6.12
  - @nextclaw/mcp@0.3.10
  - @nextclaw/ncp@0.7.8
  - @nextclaw/ncp-agent-runtime@0.4.8
  - @nextclaw/ncp-mcp@0.2.10
  - @nextclaw/ncp-toolkit@0.6.9
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.8
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.11
  - @nextclaw/remote@0.3.12
  - @nextclaw/runtime@0.4.10
  - @nextclaw/server@0.15.12
  - @nextclaw/shared@0.4.9

## 0.3.11

### Patch Changes

- 914288e: 修复重启后可能因最近一次检查记录而跳过更新检查的问题。NextClaw 现在会在每次启动时立即检查一次，运行期间继续每两小时检查；检查只更新可用版本状态，不会自动下载或应用更新。
- Updated dependencies [61f6bd1]
- Updated dependencies [97bca64]
- Updated dependencies [dad7880]
- Updated dependencies [c727720]
- Updated dependencies
- Updated dependencies [f68d2df]
- Updated dependencies [1f99bb8]
- Updated dependencies [ddc3213]
- Updated dependencies [03bbe45]
  - @nextclaw/ncp@0.7.7
  - @nextclaw/ncp-toolkit@0.6.8
  - @nextclaw/client-sdk@0.5.11
  - @nextclaw/kernel@0.6.11
  - @nextclaw/server@0.15.11
  - @nextclaw/shared@0.4.8
  - @nextclaw/core@0.15.9
  - @nextclaw/channel-extension-dingtalk@0.2.9
  - @nextclaw/channel-extension-discord@0.2.9
  - @nextclaw/channel-extension-email@0.2.9
  - @nextclaw/channel-extension-feishu@0.2.9
  - @nextclaw/channel-extension-qq@0.2.8
  - @nextclaw/channel-extension-slack@0.2.9
  - @nextclaw/channel-extension-telegram@0.2.9
  - @nextclaw/channel-extension-wecom@0.2.9
  - @nextclaw/channel-extension-weixin@0.2.9
  - @nextclaw/channel-extension-whatsapp@0.2.9
  - @nextclaw/mcp@0.3.9
  - @nextclaw/ncp-agent-runtime@0.4.7
  - @nextclaw/ncp-mcp@0.2.9
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.7
  - @nextclaw/runtime@0.4.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.10
  - @nextclaw/remote@0.3.11

## 0.3.10

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.2.8
  - @nextclaw/channel-extension-discord@0.2.8
  - @nextclaw/channel-extension-email@0.2.8
  - @nextclaw/channel-extension-feishu@0.2.8
  - @nextclaw/channel-extension-qq@0.2.7
  - @nextclaw/channel-extension-slack@0.2.8
  - @nextclaw/channel-extension-telegram@0.2.8
  - @nextclaw/channel-extension-wecom@0.2.8
  - @nextclaw/channel-extension-weixin@0.2.8
  - @nextclaw/channel-extension-whatsapp@0.2.8
  - @nextclaw/client-sdk@0.5.10
  - @nextclaw/core@0.15.8
  - @nextclaw/kernel@0.6.10
  - @nextclaw/mcp@0.3.8
  - @nextclaw/ncp@0.7.6
  - @nextclaw/ncp-agent-runtime@0.4.6
  - @nextclaw/ncp-mcp@0.2.8
  - @nextclaw/ncp-toolkit@0.6.7
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.9
  - @nextclaw/remote@0.3.10
  - @nextclaw/runtime@0.4.8
  - @nextclaw/server@0.15.10
  - @nextclaw/shared@0.4.7

## 0.3.9

### Patch Changes

- 0111b09: 让桌面端与 NPM 安装态在持续运行期间固定每两小时自动检查更新，不再提供关闭自动检查或启用自动下载的配置；发现新版本后只提示用户，由用户明确点击后才下载和应用。更新通道切换会等待旧检查收口后检查新通道，避免复用过期结果。同步增强本地更新验证，使开发者无需等待真实发版或重启即可验证自动发现、手动下载、应用和版本切换。
- Updated dependencies
- Updated dependencies [0111b09]
  - @nextclaw/channel-extension-dingtalk@0.2.7
  - @nextclaw/channel-extension-discord@0.2.7
  - @nextclaw/channel-extension-email@0.2.7
  - @nextclaw/channel-extension-feishu@0.2.7
  - @nextclaw/channel-extension-qq@0.2.6
  - @nextclaw/channel-extension-slack@0.2.7
  - @nextclaw/channel-extension-telegram@0.2.7
  - @nextclaw/channel-extension-wecom@0.2.7
  - @nextclaw/channel-extension-weixin@0.2.7
  - @nextclaw/channel-extension-whatsapp@0.2.7
  - @nextclaw/core@0.15.7
  - @nextclaw/mcp@0.3.7
  - @nextclaw/ncp@0.7.5
  - @nextclaw/ncp-agent-runtime@0.4.5
  - @nextclaw/ncp-mcp@0.2.7
  - @nextclaw/ncp-toolkit@0.6.6
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.8
  - @nextclaw/remote@0.3.9
  - @nextclaw/runtime@0.4.7
  - @nextclaw/kernel@0.6.9
  - @nextclaw/client-sdk@0.5.9
  - @nextclaw/server@0.15.9
  - @nextclaw/shared@0.4.6

## 0.3.8

### Patch Changes

- 8f7e915: 修复运行时更新应用后的后续检查可能把“新版本已运行但验证失败”笼统显示为更新失败的问题；页面会区分检查、下载和应用失败，展示完整错误原因，并给出查看完整日志的命令。
- Updated dependencies [a9b125f]
- Updated dependencies [8f7e915]
  - @nextclaw/core@0.15.6
  - @nextclaw/kernel@0.6.8
  - @nextclaw/shared@0.4.5
  - @nextclaw/channel-extension-dingtalk@0.2.6
  - @nextclaw/channel-extension-discord@0.2.6
  - @nextclaw/channel-extension-email@0.2.6
  - @nextclaw/channel-extension-slack@0.2.6
  - @nextclaw/channel-extension-telegram@0.2.6
  - @nextclaw/channel-extension-wecom@0.2.6
  - @nextclaw/channel-extension-whatsapp@0.2.6
  - @nextclaw/mcp@0.3.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.7
  - @nextclaw/remote@0.3.8
  - @nextclaw/runtime@0.4.6
  - @nextclaw/server@0.15.8
  - @nextclaw/client-sdk@0.5.8
  - @nextclaw/ncp-mcp@0.2.6
  - @nextclaw/channel-extension-feishu@0.2.6
  - @nextclaw/channel-extension-qq@0.2.5
  - @nextclaw/channel-extension-weixin@0.2.6

## 0.3.7

### Patch Changes

- Updated dependencies [00c0d23]
- Updated dependencies [897211a]
  - @nextclaw/kernel@0.6.7
  - @nextclaw/server@0.15.7
  - @nextclaw/remote@0.3.7
  - @nextclaw/client-sdk@0.5.7

## 0.3.6

### Patch Changes

- 59a4723: 新增独立项目注册表与项目模板：项目可以在没有会话时通过界面、CLI 或 AI 创建并展示；界面提供支持导航、搜索和新建文件夹的跨平台服务端目录选择器，并按 macOS、Windows 与 Linux 展示实际可用的常用位置；CLI 与 AI 还可列出项目、修改会话名称及项目目录。
- 8f7e915: 修复运行时更新期间页面状态可能停滞，以及应用更新后仍继续启动旧版本的问题：检查和下载完成后页面会直接进入下一状态，更新完成后会自动切换到新运行包，无需刷新页面或手动执行 restart。
- Updated dependencies [2eceb16]
- Updated dependencies [25f8bb0]
- Updated dependencies [59a4723]
- Updated dependencies [8be3173]
  - @nextclaw/client-sdk@0.5.6
  - @nextclaw/kernel@0.6.6
  - @nextclaw/server@0.15.6
  - @nextclaw/shared@0.4.4
  - @nextclaw/ncp@0.7.4
  - @nextclaw/ncp-toolkit@0.6.5
  - @nextclaw/core@0.15.5
  - @nextclaw/remote@0.3.6
  - @nextclaw/channel-extension-feishu@0.2.5
  - @nextclaw/channel-extension-weixin@0.2.5
  - @nextclaw/ncp-agent-runtime@0.4.4
  - @nextclaw/ncp-mcp@0.2.5
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.6
  - @nextclaw/channel-extension-dingtalk@0.2.5
  - @nextclaw/channel-extension-discord@0.2.5
  - @nextclaw/channel-extension-email@0.2.5
  - @nextclaw/channel-extension-slack@0.2.5
  - @nextclaw/channel-extension-telegram@0.2.5
  - @nextclaw/channel-extension-wecom@0.2.5
  - @nextclaw/channel-extension-whatsapp@0.2.5
  - @nextclaw/mcp@0.3.5
  - @nextclaw/runtime@0.4.5
  - @nextclaw/channel-extension-qq@0.2.4

## 0.3.5

### Patch Changes

- Updated dependencies [378c8b9]
- Updated dependencies [c01ca0a]
- Updated dependencies [401854e]
  - @nextclaw/kernel@0.6.5
  - @nextclaw/client-sdk@0.5.5
  - @nextclaw/server@0.15.5
  - @nextclaw/core@0.15.4
  - @nextclaw/remote@0.3.5
  - @nextclaw/channel-extension-dingtalk@0.2.4
  - @nextclaw/channel-extension-discord@0.2.4
  - @nextclaw/channel-extension-email@0.2.4
  - @nextclaw/channel-extension-slack@0.2.4
  - @nextclaw/channel-extension-telegram@0.2.4
  - @nextclaw/channel-extension-wecom@0.2.4
  - @nextclaw/channel-extension-whatsapp@0.2.4
  - @nextclaw/mcp@0.3.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.5
  - @nextclaw/runtime@0.4.4
  - @nextclaw/ncp-mcp@0.2.4

## 0.3.4

### Patch Changes

- Updated dependencies [91f7bef]
- Updated dependencies [7853b3b]
  - @nextclaw/kernel@0.6.4
  - @nextclaw/server@0.15.4
  - @nextclaw/ncp-toolkit@0.6.4
  - @nextclaw/remote@0.3.4
  - @nextclaw/client-sdk@0.5.4
  - @nextclaw/channel-extension-feishu@0.2.4
  - @nextclaw/channel-extension-weixin@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.4

## 0.3.3

### Patch Changes

- Auto-generated full public release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.2.3
  - @nextclaw/channel-extension-discord@0.2.3
  - @nextclaw/channel-extension-email@0.2.3
  - @nextclaw/channel-extension-feishu@0.2.3
  - @nextclaw/channel-extension-qq@0.2.3
  - @nextclaw/channel-extension-slack@0.2.3
  - @nextclaw/channel-extension-telegram@0.2.3
  - @nextclaw/channel-extension-wecom@0.2.3
  - @nextclaw/channel-extension-weixin@0.2.3
  - @nextclaw/channel-extension-whatsapp@0.2.3
  - @nextclaw/client-sdk@0.5.3
  - @nextclaw/core@0.15.3
  - @nextclaw/kernel@0.6.3
  - @nextclaw/mcp@0.3.3
  - @nextclaw/ncp@0.7.3
  - @nextclaw/ncp-agent-runtime@0.4.3
  - @nextclaw/ncp-mcp@0.2.3
  - @nextclaw/ncp-toolkit@0.6.3
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.3
  - @nextclaw/remote@0.3.3
  - @nextclaw/runtime@0.4.3
  - @nextclaw/server@0.15.3
  - @nextclaw/shared@0.4.3

## 0.3.2

### Patch Changes

- Publish the full public NextClaw workspace as a unified stable patch release.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- Updated dependencies
- Updated dependencies [51cf740]
- Updated dependencies [94c5ab6]
- Updated dependencies [3fdb755]
  - @nextclaw/channel-extension-dingtalk@0.2.2
  - @nextclaw/channel-extension-discord@0.2.2
  - @nextclaw/channel-extension-email@0.2.2
  - @nextclaw/channel-extension-feishu@0.2.2
  - @nextclaw/channel-extension-qq@0.2.2
  - @nextclaw/channel-extension-slack@0.2.2
  - @nextclaw/channel-extension-telegram@0.2.2
  - @nextclaw/channel-extension-wecom@0.2.2
  - @nextclaw/channel-extension-weixin@0.2.2
  - @nextclaw/channel-extension-whatsapp@0.2.2
  - @nextclaw/mcp@0.3.2
  - @nextclaw/ncp@0.7.2
  - @nextclaw/ncp-mcp@0.2.2
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.2
  - @nextclaw/remote@0.3.2
  - @nextclaw/runtime@0.4.2
  - @nextclaw/shared@0.4.2
  - @nextclaw/ncp-agent-runtime@0.4.2
  - @nextclaw/core@0.15.2
  - @nextclaw/kernel@0.6.2
  - @nextclaw/ncp-toolkit@0.6.2
  - @nextclaw/server@0.15.2
  - @nextclaw/client-sdk@0.5.2

## 0.3.1

### Patch Changes

- Updated dependencies [7e94f21]
- Updated dependencies [1cc5d4e]
- Updated dependencies [09b7406]
- Updated dependencies [e6a3443]
- Updated dependencies [1cc5d4e]
- Updated dependencies [a006bb7]
  - @nextclaw/server@0.15.1
  - @nextclaw/core@0.15.1
  - @nextclaw/kernel@0.6.1
  - @nextclaw/ncp@0.7.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.1
  - @nextclaw/client-sdk@0.5.1
  - @nextclaw/remote@0.3.1
  - @nextclaw/channel-extension-dingtalk@0.2.1
  - @nextclaw/channel-extension-discord@0.2.1
  - @nextclaw/channel-extension-email@0.2.1
  - @nextclaw/channel-extension-slack@0.2.1
  - @nextclaw/channel-extension-telegram@0.2.1
  - @nextclaw/channel-extension-wecom@0.2.1
  - @nextclaw/channel-extension-whatsapp@0.2.1
  - @nextclaw/mcp@0.3.1
  - @nextclaw/runtime@0.4.1
  - @nextclaw/channel-extension-feishu@0.2.1
  - @nextclaw/channel-extension-weixin@0.2.1
  - @nextclaw/ncp-agent-runtime@0.4.1
  - @nextclaw/ncp-mcp@0.2.1
  - @nextclaw/ncp-toolkit@0.6.1
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.1
  - @nextclaw/shared@0.4.1
  - @nextclaw/channel-extension-qq@0.2.1

## 0.3.0

### Minor Changes

- Publish the full public NextClaw workspace as a stable minor release.

### Patch Changes

- Updated dependencies [34f4048]
- Updated dependencies [3cf5890]
- Updated dependencies [bf1917a]
- Updated dependencies
- Updated dependencies [6600b99]
- Updated dependencies [191c011]
- Updated dependencies [61e7a7a]
- Updated dependencies [549fb8a]
- Updated dependencies [33a931f]
- Updated dependencies [0c06d9d]
- Updated dependencies [7bcc180]
- Updated dependencies [2d9d1b7]
- Updated dependencies [7bcc180]
- Updated dependencies [b0cb8c2]
  - @nextclaw/kernel@0.6.0
  - @nextclaw/ncp-agent-runtime@0.4.0
  - @nextclaw/core@0.15.0
  - @nextclaw/channel-extension-dingtalk@0.2.0
  - @nextclaw/channel-extension-discord@0.2.0
  - @nextclaw/channel-extension-email@0.2.0
  - @nextclaw/channel-extension-feishu@0.2.0
  - @nextclaw/channel-extension-qq@0.2.0
  - @nextclaw/channel-extension-slack@0.2.0
  - @nextclaw/channel-extension-telegram@0.2.0
  - @nextclaw/channel-extension-wecom@0.2.0
  - @nextclaw/channel-extension-weixin@0.2.0
  - @nextclaw/channel-extension-whatsapp@0.2.0
  - @nextclaw/client-sdk@0.5.0
  - @nextclaw/mcp@0.3.0
  - @nextclaw/ncp@0.7.0
  - @nextclaw/ncp-mcp@0.2.0
  - @nextclaw/ncp-toolkit@0.6.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.3.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.3.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.3.0
  - @nextclaw/remote@0.3.0
  - @nextclaw/runtime@0.4.0
  - @nextclaw/server@0.15.0
  - @nextclaw/shared@0.4.0

## 0.2.18

### Patch Changes

- e990291: Use the nextclaw.net domestic marketplace mirror by default for marketplace reads, with automatic fallback to the official marketplace API when the mirror request fails or times out.
- Updated dependencies [944c27b]
- Updated dependencies [e990291]
  - @nextclaw/channel-extension-dingtalk@0.1.22
  - @nextclaw/channel-extension-discord@0.1.22
  - @nextclaw/channel-extension-email@0.1.22
  - @nextclaw/channel-extension-feishu@0.1.28
  - @nextclaw/channel-extension-qq@0.1.25
  - @nextclaw/channel-extension-slack@0.1.22
  - @nextclaw/channel-extension-telegram@0.1.22
  - @nextclaw/channel-extension-wecom@0.1.22
  - @nextclaw/channel-extension-weixin@0.1.32
  - @nextclaw/channel-extension-whatsapp@0.1.22
  - @nextclaw/client-sdk@0.4.7
  - @nextclaw/core@0.14.8
  - @nextclaw/kernel@0.5.4
  - @nextclaw/mcp@0.2.18
  - @nextclaw/ncp@0.6.6
  - @nextclaw/ncp-agent-runtime@0.3.47
  - @nextclaw/ncp-mcp@0.1.113
  - @nextclaw/ncp-toolkit@0.5.41
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.16
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17
  - @nextclaw/remote@0.2.18
  - @nextclaw/runtime@0.3.18
  - @nextclaw/shared@0.3.3
  - @nextclaw/server@0.14.8

## 0.2.18-beta.0

### Patch Changes

- e990291: Use the nextclaw.net domestic marketplace mirror by default for marketplace reads, with automatic fallback to the official marketplace API when the mirror request fails or times out.
- Updated dependencies
- Updated dependencies [e990291]
  - @nextclaw/channel-extension-dingtalk@0.1.22-beta.0
  - @nextclaw/channel-extension-discord@0.1.22-beta.0
  - @nextclaw/channel-extension-email@0.1.22-beta.0
  - @nextclaw/channel-extension-feishu@0.1.28-beta.0
  - @nextclaw/channel-extension-qq@0.1.25-beta.0
  - @nextclaw/channel-extension-slack@0.1.22-beta.0
  - @nextclaw/channel-extension-telegram@0.1.22-beta.0
  - @nextclaw/channel-extension-wecom@0.1.22-beta.0
  - @nextclaw/channel-extension-weixin@0.1.32-beta.0
  - @nextclaw/channel-extension-whatsapp@0.1.22-beta.0
  - @nextclaw/client-sdk@0.4.7-beta.0
  - @nextclaw/core@0.14.8-beta.0
  - @nextclaw/kernel@0.5.4-beta.0
  - @nextclaw/mcp@0.2.18-beta.0
  - @nextclaw/ncp@0.6.6-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.47-beta.0
  - @nextclaw/ncp-mcp@0.1.113-beta.0
  - @nextclaw/ncp-toolkit@0.5.41-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.16-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.16-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.17-beta.0
  - @nextclaw/remote@0.2.18-beta.0
  - @nextclaw/runtime@0.3.18-beta.0
  - @nextclaw/shared@0.3.3-beta.0
  - @nextclaw/server@0.14.8-beta.0

## 0.2.17

### Patch Changes

- Updated dependencies [901f770]
  - @nextclaw/core@0.14.7
  - @nextclaw/kernel@0.5.3
  - @nextclaw/channel-extension-dingtalk@0.1.21
  - @nextclaw/channel-extension-discord@0.1.21
  - @nextclaw/channel-extension-email@0.1.21
  - @nextclaw/channel-extension-slack@0.1.21
  - @nextclaw/channel-extension-telegram@0.1.21
  - @nextclaw/channel-extension-wecom@0.1.21
  - @nextclaw/channel-extension-whatsapp@0.1.21
  - @nextclaw/mcp@0.2.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.16
  - @nextclaw/remote@0.2.17
  - @nextclaw/runtime@0.3.17
  - @nextclaw/server@0.14.7
  - @nextclaw/ncp-mcp@0.1.112
  - @nextclaw/client-sdk@0.4.6

## 0.2.16

### Patch Changes

- Auto-generated full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - nextclaw

- Updated dependencies
- Updated dependencies [993fbb8]
- Updated dependencies [d406755]
- Updated dependencies [6586a69]
  - @nextclaw/channel-extension-dingtalk@0.1.20
  - @nextclaw/channel-extension-discord@0.1.20
  - @nextclaw/channel-extension-email@0.1.20
  - @nextclaw/channel-extension-feishu@0.1.27
  - @nextclaw/channel-extension-qq@0.1.24
  - @nextclaw/channel-extension-slack@0.1.20
  - @nextclaw/channel-extension-telegram@0.1.20
  - @nextclaw/channel-extension-wecom@0.1.20
  - @nextclaw/channel-extension-weixin@0.1.31
  - @nextclaw/channel-extension-whatsapp@0.1.20
  - @nextclaw/client-sdk@0.4.5
  - @nextclaw/mcp@0.2.16
  - @nextclaw/ncp@0.6.5
  - @nextclaw/ncp-agent-runtime@0.3.46
  - @nextclaw/ncp-mcp@0.1.111
  - @nextclaw/ncp-toolkit@0.5.40
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.15
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.15
  - @nextclaw/remote@0.2.16
  - @nextclaw/runtime@0.3.16
  - @nextclaw/server@0.14.6
  - @nextclaw/core@0.14.6
  - @nextclaw/kernel@0.5.2
  - @nextclaw/shared@0.3.2

## 0.2.15

### Patch Changes

- f8dfffa: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- Updated dependencies [f8dfffa]
- Updated dependencies [7067713]
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [31601cd]
- Updated dependencies [13b1d96]
- Updated dependencies [9c02046]
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [461f681]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-dingtalk@0.1.19
  - @nextclaw/channel-extension-discord@0.1.19
  - @nextclaw/channel-extension-email@0.1.19
  - @nextclaw/channel-extension-feishu@0.1.26
  - @nextclaw/channel-extension-qq@0.1.23
  - @nextclaw/channel-extension-slack@0.1.19
  - @nextclaw/channel-extension-telegram@0.1.19
  - @nextclaw/channel-extension-wecom@0.1.19
  - @nextclaw/channel-extension-weixin@0.1.30
  - @nextclaw/channel-extension-whatsapp@0.1.19
  - @nextclaw/client-sdk@0.4.4
  - @nextclaw/mcp@0.2.15
  - @nextclaw/ncp-agent-runtime@0.3.45
  - @nextclaw/ncp-mcp@0.1.110
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.14
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14
  - @nextclaw/remote@0.2.15
  - @nextclaw/runtime@0.3.15
  - @nextclaw/core@0.14.5
  - @nextclaw/ncp@0.6.4
  - @nextclaw/ncp-toolkit@0.5.39
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14
  - @nextclaw/shared@0.3.1
  - @nextclaw/server@0.14.5
  - @nextclaw/kernel@0.5.1

## 0.2.15-beta.1

### Patch Changes

- 9c02046: Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
- Updated dependencies
- Updated dependencies [6bb305f]
- Updated dependencies [9c02046]
- Updated dependencies [461f681]
  - @nextclaw/channel-extension-dingtalk@0.1.19-beta.1
  - @nextclaw/channel-extension-discord@0.1.19-beta.1
  - @nextclaw/channel-extension-email@0.1.19-beta.1
  - @nextclaw/channel-extension-feishu@0.1.26-beta.1
  - @nextclaw/channel-extension-slack@0.1.19-beta.1
  - @nextclaw/channel-extension-telegram@0.1.19-beta.1
  - @nextclaw/channel-extension-wecom@0.1.19-beta.1
  - @nextclaw/channel-extension-weixin@0.1.30-beta.1
  - @nextclaw/channel-extension-whatsapp@0.1.19-beta.1
  - @nextclaw/client-sdk@0.4.4-beta.1
  - @nextclaw/core@0.14.5-beta.1
  - @nextclaw/mcp@0.2.15-beta.1
  - @nextclaw/ncp@0.6.4-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.1
  - @nextclaw/ncp-mcp@0.1.110-beta.1
  - @nextclaw/ncp-toolkit@0.5.39-beta.1
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.14-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.1
  - @nextclaw/remote@0.2.15-beta.1
  - @nextclaw/runtime@0.3.15-beta.1
  - @nextclaw/shared@0.3.1-beta.1
  - @nextclaw/kernel@0.5.1-beta.1
  - @nextclaw/server@0.14.5-beta.1
  - @nextclaw/channel-extension-qq@0.1.23-beta.1

## 0.2.15-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- Updated dependencies
- Updated dependencies [13b1d96]
- Updated dependencies [595cc16]
- Updated dependencies [5117e15]
- Updated dependencies [d82790a]
- Updated dependencies [07d776b]
  - @nextclaw/channel-extension-dingtalk@0.1.19-beta.0
  - @nextclaw/channel-extension-discord@0.1.19-beta.0
  - @nextclaw/channel-extension-email@0.1.19-beta.0
  - @nextclaw/channel-extension-feishu@0.1.26-beta.0
  - @nextclaw/channel-extension-qq@0.1.23-beta.0
  - @nextclaw/channel-extension-slack@0.1.19-beta.0
  - @nextclaw/channel-extension-telegram@0.1.19-beta.0
  - @nextclaw/channel-extension-wecom@0.1.19-beta.0
  - @nextclaw/channel-extension-weixin@0.1.30-beta.0
  - @nextclaw/channel-extension-whatsapp@0.1.19-beta.0
  - @nextclaw/client-sdk@0.4.4-beta.0
  - @nextclaw/mcp@0.2.15-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.45-beta.0
  - @nextclaw/ncp-mcp@0.1.110-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.14-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.14-beta.0
  - @nextclaw/remote@0.2.15-beta.0
  - @nextclaw/runtime@0.3.15-beta.0
  - @nextclaw/kernel@0.5.1-beta.0
  - @nextclaw/core@0.14.5-beta.0
  - @nextclaw/server@0.14.5-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.14-beta.0
  - @nextclaw/shared@0.3.1-beta.0
  - @nextclaw/ncp@0.6.4-beta.0
  - @nextclaw/ncp-toolkit@0.5.39-beta.0

## 0.2.14

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - nextclaw

- Updated dependencies [89f2f73]
- Updated dependencies
- Updated dependencies [c4ee481]
- Updated dependencies [d2ca679]
- Updated dependencies [3624bbb]
- Updated dependencies [3624bbb]
  - @nextclaw/core@0.14.4
  - @nextclaw/kernel@0.5.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.13
  - @nextclaw/channel-extension-dingtalk@0.1.18
  - @nextclaw/channel-extension-discord@0.1.18
  - @nextclaw/channel-extension-email@0.1.18
  - @nextclaw/channel-extension-feishu@0.1.25
  - @nextclaw/channel-extension-qq@0.1.22
  - @nextclaw/channel-extension-slack@0.1.18
  - @nextclaw/channel-extension-telegram@0.1.18
  - @nextclaw/channel-extension-wecom@0.1.18
  - @nextclaw/channel-extension-weixin@0.1.29
  - @nextclaw/channel-extension-whatsapp@0.1.18
  - @nextclaw/client-sdk@0.4.3
  - @nextclaw/mcp@0.2.14
  - @nextclaw/ncp@0.6.3
  - @nextclaw/ncp-agent-runtime@0.3.44
  - @nextclaw/ncp-mcp@0.1.109
  - @nextclaw/ncp-toolkit@0.5.38
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.13
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.13
  - @nextclaw/remote@0.2.14
  - @nextclaw/runtime@0.3.14
  - @nextclaw/shared@0.3.0
  - @nextclaw/server@0.14.4

## 0.2.13

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/browser-connector
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared

- Updated dependencies
- Updated dependencies [6b44d57]
- Updated dependencies [d20dc48]
- Updated dependencies [aa681ba]
- Updated dependencies [e283af5]
- Updated dependencies [7eed591]
  - @nextclaw/channel-extension-dingtalk@0.1.17
  - @nextclaw/channel-extension-discord@0.1.17
  - @nextclaw/channel-extension-email@0.1.17
  - @nextclaw/channel-extension-feishu@0.1.24
  - @nextclaw/channel-extension-qq@0.1.21
  - @nextclaw/channel-extension-slack@0.1.17
  - @nextclaw/channel-extension-telegram@0.1.17
  - @nextclaw/channel-extension-wecom@0.1.17
  - @nextclaw/channel-extension-weixin@0.1.28
  - @nextclaw/channel-extension-whatsapp@0.1.17
  - @nextclaw/client-sdk@0.4.2
  - @nextclaw/mcp@0.2.13
  - @nextclaw/ncp@0.6.2
  - @nextclaw/ncp-agent-runtime@0.3.43
  - @nextclaw/ncp-toolkit@0.5.37
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.12
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.12
  - @nextclaw/remote@0.2.13
  - @nextclaw/server@0.14.3
  - @nextclaw/shared@0.2.12
  - @nextclaw/core@0.14.3
  - @nextclaw/kernel@0.4.3
  - @nextclaw/runtime@0.3.13
  - @nextclaw/ncp-mcp@0.1.108

## 0.2.12

### Patch Changes

- 990a171: Fix npm runtime update checks so a beta launcher can detect and update to the matching stable release.
- Updated dependencies
- Updated dependencies [36c4e56]
  - @nextclaw/channel-extension-dingtalk@0.1.16
  - @nextclaw/channel-extension-discord@0.1.16
  - @nextclaw/channel-extension-email@0.1.16
  - @nextclaw/channel-extension-feishu@0.1.23
  - @nextclaw/channel-extension-qq@0.1.20
  - @nextclaw/channel-extension-slack@0.1.16
  - @nextclaw/channel-extension-telegram@0.1.16
  - @nextclaw/channel-extension-wecom@0.1.16
  - @nextclaw/channel-extension-weixin@0.1.27
  - @nextclaw/channel-extension-whatsapp@0.1.16
  - @nextclaw/client-sdk@0.4.1
  - @nextclaw/core@0.14.2
  - @nextclaw/mcp@0.2.12
  - @nextclaw/ncp-agent-runtime@0.3.42
  - @nextclaw/ncp-mcp@0.1.107
  - @nextclaw/ncp-toolkit@0.5.36
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.11
  - @nextclaw/remote@0.2.12
  - @nextclaw/runtime@0.3.12
  - @nextclaw/server@0.14.2
  - @nextclaw/shared@0.2.11
  - @nextclaw/ncp@0.6.1
  - @nextclaw/kernel@0.4.2

## 0.2.11

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - nextclaw

- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies [1ed5aff]
- Updated dependencies
- Updated dependencies [78fcd8f]
- Updated dependencies [42281c8]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-dingtalk@0.1.15
  - @nextclaw/channel-extension-discord@0.1.15
  - @nextclaw/channel-extension-email@0.1.15
  - @nextclaw/channel-extension-feishu@0.1.22
  - @nextclaw/channel-extension-qq@0.1.19
  - @nextclaw/channel-extension-slack@0.1.15
  - @nextclaw/channel-extension-telegram@0.1.15
  - @nextclaw/channel-extension-wecom@0.1.15
  - @nextclaw/channel-extension-weixin@0.1.26
  - @nextclaw/channel-extension-whatsapp@0.1.15
  - @nextclaw/mcp@0.2.11
  - @nextclaw/ncp-agent-runtime@0.3.41
  - @nextclaw/ncp-mcp@0.1.106
  - @nextclaw/ncp-toolkit@0.5.35
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10
  - @nextclaw/remote@0.2.11
  - @nextclaw/runtime@0.3.11
  - @nextclaw/shared@0.2.10
  - @nextclaw/client-sdk@0.4.0
  - @nextclaw/ncp@0.6.0
  - @nextclaw/server@0.14.1
  - @nextclaw/core@0.14.1
  - @nextclaw/kernel@0.4.1

## 0.2.11-beta.0

### Patch Changes

- 6ec95a0: Fix Panel App sandbox loading and runtime API access, make injected App Client browser fetch calls safe inside Panel Apps, refresh the served client SDK bundle after rebuilds, show Panel App titles in the app toolbar, and teach bundled app-creation skills not to rely on browser storage inside sandboxed Panel Apps.
- Updated dependencies
- Updated dependencies [42281c8]
- Updated dependencies [cc024b3]
- Updated dependencies [458c9b0]
- Updated dependencies [6ec95a0]
  - @nextclaw/channel-extension-dingtalk@0.1.15-beta.0
  - @nextclaw/channel-extension-discord@0.1.15-beta.0
  - @nextclaw/channel-extension-email@0.1.15-beta.0
  - @nextclaw/channel-extension-feishu@0.1.22-beta.0
  - @nextclaw/channel-extension-qq@0.1.19-beta.0
  - @nextclaw/channel-extension-slack@0.1.15-beta.0
  - @nextclaw/channel-extension-telegram@0.1.15-beta.0
  - @nextclaw/channel-extension-wecom@0.1.15-beta.0
  - @nextclaw/channel-extension-weixin@0.1.26-beta.0
  - @nextclaw/channel-extension-whatsapp@0.1.15-beta.0
  - @nextclaw/mcp@0.2.11-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.41-beta.0
  - @nextclaw/ncp-mcp@0.1.106-beta.0
  - @nextclaw/ncp-toolkit@0.5.35-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.10-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.10-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.10-beta.0
  - @nextclaw/remote@0.2.11-beta.0
  - @nextclaw/runtime@0.3.11-beta.0
  - @nextclaw/shared@0.2.10-beta.0
  - @nextclaw/kernel@0.4.1-beta.0
  - @nextclaw/ncp@0.6.0-beta.0
  - @nextclaw/client-sdk@0.4.0-beta.0
  - @nextclaw/server@0.14.1-beta.0
  - @nextclaw/core@0.14.1-beta.0

## 0.2.10

### Patch Changes

- 43da21a: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- Updated dependencies [14c5730]
- Updated dependencies [43da21a]
- Updated dependencies [bfa611f]
- Updated dependencies [226b3cf]
- Updated dependencies [0dc6471]
- Updated dependencies [86a0dc8]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
- Updated dependencies [170c8be]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-dingtalk@0.1.14
  - @nextclaw/channel-extension-discord@0.1.14
  - @nextclaw/channel-extension-email@0.1.14
  - @nextclaw/channel-extension-feishu@0.1.21
  - @nextclaw/channel-extension-qq@0.1.18
  - @nextclaw/channel-extension-slack@0.1.14
  - @nextclaw/channel-extension-telegram@0.1.14
  - @nextclaw/channel-extension-wecom@0.1.14
  - @nextclaw/channel-extension-weixin@0.1.25
  - @nextclaw/channel-extension-whatsapp@0.1.14
  - @nextclaw/mcp@0.2.10
  - @nextclaw/ncp@0.5.29
  - @nextclaw/ncp-agent-runtime@0.3.40
  - @nextclaw/ncp-mcp@0.1.105
  - @nextclaw/ncp-toolkit@0.5.34
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9
  - @nextclaw/remote@0.2.10
  - @nextclaw/runtime@0.3.10
  - @nextclaw/shared@0.2.9
  - @nextclaw/client-sdk@0.3.0
  - @nextclaw/server@0.14.0
  - @nextclaw/core@0.14.0
  - @nextclaw/kernel@0.4.0

## 0.2.10-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/aigen
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/companion
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/service
  - @nextclaw/shared

- Updated dependencies
- Updated dependencies [bfa611f]
- Updated dependencies [226b3cf]
- Updated dependencies [240d5ab]
- Updated dependencies [75e0dcb]
  - @nextclaw/channel-extension-dingtalk@0.1.14-beta.1
  - @nextclaw/channel-extension-discord@0.1.14-beta.1
  - @nextclaw/channel-extension-email@0.1.14-beta.1
  - @nextclaw/channel-extension-feishu@0.1.21-beta.1
  - @nextclaw/channel-extension-qq@0.1.18-beta.1
  - @nextclaw/channel-extension-slack@0.1.14-beta.1
  - @nextclaw/channel-extension-telegram@0.1.14-beta.1
  - @nextclaw/channel-extension-wecom@0.1.14-beta.1
  - @nextclaw/channel-extension-weixin@0.1.25-beta.1
  - @nextclaw/channel-extension-whatsapp@0.1.14-beta.1
  - @nextclaw/mcp@0.2.10-beta.1
  - @nextclaw/ncp@0.5.29-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.1
  - @nextclaw/ncp-mcp@0.1.105-beta.1
  - @nextclaw/ncp-toolkit@0.5.34-beta.1
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.9-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.1
  - @nextclaw/remote@0.2.10-beta.1
  - @nextclaw/runtime@0.3.10-beta.1
  - @nextclaw/shared@0.2.9-beta.1
  - @nextclaw/client-sdk@0.3.0-beta.1
  - @nextclaw/server@0.14.0-beta.1
  - @nextclaw/core@0.14.0-beta.1
  - @nextclaw/kernel@0.4.0-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.1

## 0.2.10-beta.0

### Patch Changes

- 86a0dc8: Inject the standard NextClaw client SDK into authorized folder Panel Apps as `window.nextclaw.client`, with persistent app-level client grants and the existing bridge APIs preserved.
- Updated dependencies
- Updated dependencies [86a0dc8]
- Updated dependencies [170c8be]
- Updated dependencies [86acdbe]
  - @nextclaw/channel-extension-dingtalk@0.1.14-beta.0
  - @nextclaw/channel-extension-discord@0.1.14-beta.0
  - @nextclaw/channel-extension-email@0.1.14-beta.0
  - @nextclaw/channel-extension-feishu@0.1.21-beta.0
  - @nextclaw/channel-extension-qq@0.1.18-beta.0
  - @nextclaw/channel-extension-slack@0.1.14-beta.0
  - @nextclaw/channel-extension-telegram@0.1.14-beta.0
  - @nextclaw/channel-extension-wecom@0.1.14-beta.0
  - @nextclaw/channel-extension-weixin@0.1.25-beta.0
  - @nextclaw/channel-extension-whatsapp@0.1.14-beta.0
  - @nextclaw/mcp@0.2.10-beta.0
  - @nextclaw/ncp@0.5.29-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.40-beta.0
  - @nextclaw/ncp-mcp@0.1.105-beta.0
  - @nextclaw/ncp-toolkit@0.5.34-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.9-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.9-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.9-beta.0
  - @nextclaw/remote@0.2.10-beta.0
  - @nextclaw/runtime@0.3.10-beta.0
  - @nextclaw/shared@0.2.9-beta.0
  - @nextclaw/client-sdk@0.2.10-beta.0
  - @nextclaw/core@0.13.10-beta.0
  - @nextclaw/kernel@0.3.4-beta.0
  - @nextclaw/server@0.13.10-beta.0

## 0.2.9

### Patch Changes

- 3061877: Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
- Updated dependencies
- Updated dependencies [3061877]
  - @nextclaw/channel-extension-dingtalk@0.1.13
  - @nextclaw/channel-extension-discord@0.1.13
  - @nextclaw/channel-extension-email@0.1.13
  - @nextclaw/channel-extension-feishu@0.1.20
  - @nextclaw/channel-extension-qq@0.1.17
  - @nextclaw/channel-extension-slack@0.1.13
  - @nextclaw/channel-extension-telegram@0.1.13
  - @nextclaw/channel-extension-wecom@0.1.13
  - @nextclaw/channel-extension-whatsapp@0.1.13
  - @nextclaw/mcp@0.2.9
  - @nextclaw/ncp@0.5.28
  - @nextclaw/ncp-agent-runtime@0.3.39
  - @nextclaw/ncp-mcp@0.1.104
  - @nextclaw/ncp-toolkit@0.5.33
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.8
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.8
  - @nextclaw/remote@0.2.9
  - @nextclaw/runtime@0.3.9
  - @nextclaw/shared@0.2.8
  - @nextclaw/core@0.13.9
  - @nextclaw/kernel@0.3.3
  - @nextclaw/server@0.13.9
  - @nextclaw/channel-extension-weixin@0.1.24

## 0.2.8

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.12
  - @nextclaw/channel-extension-discord@0.1.12
  - @nextclaw/channel-extension-email@0.1.12
  - @nextclaw/channel-extension-feishu@0.1.19
  - @nextclaw/channel-extension-qq@0.1.16
  - @nextclaw/channel-extension-slack@0.1.12
  - @nextclaw/channel-extension-telegram@0.1.12
  - @nextclaw/channel-extension-wecom@0.1.12
  - @nextclaw/channel-extension-weixin@0.1.23
  - @nextclaw/channel-extension-whatsapp@0.1.12
  - @nextclaw/core@0.13.8
  - @nextclaw/kernel@0.3.2
  - @nextclaw/mcp@0.2.8
  - @nextclaw/ncp@0.5.27
  - @nextclaw/ncp-agent-runtime@0.3.38
  - @nextclaw/ncp-mcp@0.1.103
  - @nextclaw/ncp-toolkit@0.5.32
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.7
  - @nextclaw/remote@0.2.8
  - @nextclaw/runtime@0.3.8
  - @nextclaw/server@0.13.8
  - @nextclaw/shared@0.2.7

## 0.2.7

### Patch Changes

- Clarify built-in app creator skills so generated Panel Apps and Service Apps do not ask users to restart NextClaw for normal workspace changes.
- Updated dependencies
  - @nextclaw/core@0.13.7
  - @nextclaw/kernel@0.3.1
  - @nextclaw/server@0.13.7
  - @nextclaw/runtime@0.3.7
  - @nextclaw/remote@0.2.7
  - @nextclaw/mcp@0.2.7
  - @nextclaw/channel-extension-dingtalk@0.1.11
  - @nextclaw/channel-extension-discord@0.1.11
  - @nextclaw/channel-extension-email@0.1.11
  - @nextclaw/channel-extension-slack@0.1.11
  - @nextclaw/channel-extension-telegram@0.1.11
  - @nextclaw/channel-extension-wecom@0.1.11
  - @nextclaw/channel-extension-whatsapp@0.1.11
  - @nextclaw/ncp-mcp@0.1.102

## 0.2.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.10
  - @nextclaw/channel-extension-discord@0.1.10
  - @nextclaw/channel-extension-email@0.1.10
  - @nextclaw/channel-extension-feishu@0.1.18
  - @nextclaw/channel-extension-qq@0.1.15
  - @nextclaw/channel-extension-slack@0.1.10
  - @nextclaw/channel-extension-telegram@0.1.10
  - @nextclaw/channel-extension-wecom@0.1.10
  - @nextclaw/channel-extension-weixin@0.1.22
  - @nextclaw/channel-extension-whatsapp@0.1.10
  - @nextclaw/core@0.13.6
  - @nextclaw/kernel@0.3.0
  - @nextclaw/mcp@0.2.6
  - @nextclaw/ncp@0.5.26
  - @nextclaw/ncp-agent-runtime@0.3.37
  - @nextclaw/ncp-mcp@0.1.101
  - @nextclaw/ncp-toolkit@0.5.31
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.6
  - @nextclaw/remote@0.2.6
  - @nextclaw/runtime@0.3.6
  - @nextclaw/server@0.13.6
  - @nextclaw/shared@0.2.6

## 0.2.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.9
  - @nextclaw/channel-extension-discord@0.1.9
  - @nextclaw/channel-extension-email@0.1.9
  - @nextclaw/channel-extension-feishu@0.1.17
  - @nextclaw/channel-extension-qq@0.1.14
  - @nextclaw/channel-extension-slack@0.1.9
  - @nextclaw/channel-extension-telegram@0.1.9
  - @nextclaw/channel-extension-wecom@0.1.9
  - @nextclaw/channel-extension-weixin@0.1.21
  - @nextclaw/channel-extension-whatsapp@0.1.9
  - @nextclaw/core@0.13.5
  - @nextclaw/kernel@0.2.5
  - @nextclaw/mcp@0.2.5
  - @nextclaw/ncp@0.5.25
  - @nextclaw/ncp-agent-runtime@0.3.36
  - @nextclaw/ncp-mcp@0.1.100
  - @nextclaw/ncp-toolkit@0.5.30
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.5
  - @nextclaw/remote@0.2.5
  - @nextclaw/runtime@0.3.5
  - @nextclaw/server@0.13.5
  - @nextclaw/shared@0.2.5

## 0.2.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.8
  - @nextclaw/channel-extension-discord@0.1.8
  - @nextclaw/channel-extension-email@0.1.8
  - @nextclaw/channel-extension-feishu@0.1.16
  - @nextclaw/channel-extension-qq@0.1.13
  - @nextclaw/channel-extension-slack@0.1.8
  - @nextclaw/channel-extension-telegram@0.1.8
  - @nextclaw/channel-extension-wecom@0.1.8
  - @nextclaw/channel-extension-weixin@0.1.20
  - @nextclaw/channel-extension-whatsapp@0.1.8
  - @nextclaw/core@0.13.4
  - @nextclaw/kernel@0.2.4
  - @nextclaw/mcp@0.2.4
  - @nextclaw/ncp@0.5.24
  - @nextclaw/ncp-agent-runtime@0.3.35
  - @nextclaw/ncp-mcp@0.1.99
  - @nextclaw/ncp-toolkit@0.5.29
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.4
  - @nextclaw/remote@0.2.4
  - @nextclaw/runtime@0.3.4
  - @nextclaw/server@0.13.4
  - @nextclaw/shared@0.2.4

## 0.2.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.7
  - @nextclaw/channel-extension-discord@0.1.7
  - @nextclaw/channel-extension-email@0.1.7
  - @nextclaw/channel-extension-feishu@0.1.15
  - @nextclaw/channel-extension-qq@0.1.12
  - @nextclaw/channel-extension-slack@0.1.7
  - @nextclaw/channel-extension-telegram@0.1.7
  - @nextclaw/channel-extension-wecom@0.1.7
  - @nextclaw/channel-extension-weixin@0.1.19
  - @nextclaw/channel-extension-whatsapp@0.1.7
  - @nextclaw/core@0.13.3
  - @nextclaw/kernel@0.2.3
  - @nextclaw/mcp@0.2.3
  - @nextclaw/ncp@0.5.23
  - @nextclaw/ncp-agent-runtime@0.3.34
  - @nextclaw/ncp-mcp@0.1.98
  - @nextclaw/ncp-toolkit@0.5.28
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.3
  - @nextclaw/remote@0.2.3
  - @nextclaw/runtime@0.3.3
  - @nextclaw/server@0.13.3
  - @nextclaw/shared@0.2.3

## 0.2.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-runtime-opencode
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.6
  - @nextclaw/channel-extension-discord@0.1.6
  - @nextclaw/channel-extension-email@0.1.6
  - @nextclaw/channel-extension-feishu@0.1.14
  - @nextclaw/channel-extension-qq@0.1.11
  - @nextclaw/channel-extension-slack@0.1.6
  - @nextclaw/channel-extension-telegram@0.1.6
  - @nextclaw/channel-extension-wecom@0.1.6
  - @nextclaw/channel-extension-weixin@0.1.17
  - @nextclaw/channel-extension-whatsapp@0.1.6
  - @nextclaw/core@0.13.2
  - @nextclaw/kernel@0.2.2
  - @nextclaw/mcp@0.2.2
  - @nextclaw/ncp@0.5.22
  - @nextclaw/ncp-agent-runtime@0.3.33
  - @nextclaw/ncp-mcp@0.1.97
  - @nextclaw/ncp-toolkit@0.5.27
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.2
  - @nextclaw/remote@0.2.2
  - @nextclaw/runtime@0.3.2
  - @nextclaw/server@0.13.2
  - @nextclaw/shared@0.2.2

## 0.2.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.5
  - @nextclaw/channel-extension-discord@0.1.5
  - @nextclaw/channel-extension-email@0.1.5
  - @nextclaw/channel-extension-feishu@0.1.13
  - @nextclaw/channel-extension-qq@0.1.10
  - @nextclaw/channel-extension-slack@0.1.5
  - @nextclaw/channel-extension-telegram@0.1.5
  - @nextclaw/channel-extension-wecom@0.1.5
  - @nextclaw/channel-extension-weixin@0.1.16
  - @nextclaw/channel-extension-whatsapp@0.1.5
  - @nextclaw/core@0.13.1
  - @nextclaw/kernel@0.2.1
  - @nextclaw/mcp@0.2.1
  - @nextclaw/ncp@0.5.21
  - @nextclaw/ncp-agent-runtime@0.3.32
  - @nextclaw/ncp-mcp@0.1.96
  - @nextclaw/ncp-toolkit@0.5.26
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.1
  - @nextclaw/remote@0.2.1
  - @nextclaw/runtime@0.3.1
  - @nextclaw/server@0.13.1
  - @nextclaw/shared@0.2.1

## 0.2.0

### Minor Changes

- Release the NextClaw lightweight app platform as a minor feature line.

  Panel Apps now receive developer-friendly bridge results: service action lists resolve to arrays, service action invokes resolve to business payloads, and built-in app creator skills document the canonical Panel + Service + Agent contract.

### Patch Changes

- Updated dependencies
  - @nextclaw/core@0.13.0
  - @nextclaw/kernel@0.2.0
  - @nextclaw/mcp@0.2.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.2.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.2.0
  - @nextclaw/remote@0.2.0
  - @nextclaw/runtime@0.3.0
  - @nextclaw/server@0.13.0
  - @nextclaw/shared@0.2.0
  - @nextclaw/channel-extension-dingtalk@0.1.4
  - @nextclaw/channel-extension-discord@0.1.4
  - @nextclaw/channel-extension-email@0.1.4
  - @nextclaw/channel-extension-slack@0.1.4
  - @nextclaw/channel-extension-telegram@0.1.4
  - @nextclaw/channel-extension-wecom@0.1.4
  - @nextclaw/channel-extension-whatsapp@0.1.4
  - @nextclaw/channel-extension-feishu@0.1.12
  - @nextclaw/channel-extension-qq@0.1.9
  - @nextclaw/channel-extension-weixin@0.1.15
  - @nextclaw/ncp-mcp@0.1.95

## 0.1.20

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.3
  - @nextclaw/channel-extension-discord@0.1.3
  - @nextclaw/channel-extension-email@0.1.3
  - @nextclaw/channel-extension-feishu@0.1.11
  - @nextclaw/channel-extension-qq@0.1.8
  - @nextclaw/channel-extension-slack@0.1.3
  - @nextclaw/channel-extension-telegram@0.1.3
  - @nextclaw/channel-extension-wecom@0.1.3
  - @nextclaw/channel-extension-weixin@0.1.14
  - @nextclaw/channel-extension-whatsapp@0.1.3
  - @nextclaw/core@0.12.27
  - @nextclaw/kernel@0.1.17
  - @nextclaw/mcp@0.1.92
  - @nextclaw/ncp@0.5.20
  - @nextclaw/ncp-agent-runtime@0.3.31
  - @nextclaw/ncp-mcp@0.1.94
  - @nextclaw/ncp-toolkit@0.5.25
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.19
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.19
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.20
  - @nextclaw/remote@0.1.105
  - @nextclaw/runtime@0.2.59
  - @nextclaw/server@0.12.28
  - @nextclaw/shared@0.1.14

## 0.1.19

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.2
  - @nextclaw/channel-extension-discord@0.1.2
  - @nextclaw/channel-extension-email@0.1.2
  - @nextclaw/channel-extension-feishu@0.1.10
  - @nextclaw/channel-extension-qq@0.1.7
  - @nextclaw/channel-extension-slack@0.1.2
  - @nextclaw/channel-extension-telegram@0.1.2
  - @nextclaw/channel-extension-wecom@0.1.2
  - @nextclaw/channel-extension-weixin@0.1.13
  - @nextclaw/channel-extension-whatsapp@0.1.2
  - @nextclaw/core@0.12.26
  - @nextclaw/kernel@0.1.16
  - @nextclaw/mcp@0.1.91
  - @nextclaw/ncp@0.5.19
  - @nextclaw/ncp-agent-runtime@0.3.30
  - @nextclaw/ncp-mcp@0.1.93
  - @nextclaw/ncp-toolkit@0.5.24
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.18
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.18
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.19
  - @nextclaw/remote@0.1.104
  - @nextclaw/runtime@0.2.58
  - @nextclaw/server@0.12.27
  - @nextclaw/shared@0.1.13

## 0.1.18

### Patch Changes

- b99164b: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 2f4f480: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 828495f: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 25207de: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 854abec: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 26163ed: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 5535f60: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- 509b157: Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies [b99164b]
- Updated dependencies [2f4f480]
- Updated dependencies [828495f]
- Updated dependencies [25207de]
- Updated dependencies [854abec]
- Updated dependencies [26163ed]
- Updated dependencies [5535f60]
- Updated dependencies [509b157]
  - @nextclaw/channel-extension-dingtalk@0.1.1
  - @nextclaw/channel-extension-discord@0.1.1
  - @nextclaw/channel-extension-email@0.1.1
  - @nextclaw/channel-extension-feishu@0.1.9
  - @nextclaw/channel-extension-qq@0.1.6
  - @nextclaw/channel-extension-slack@0.1.1
  - @nextclaw/channel-extension-telegram@0.1.1
  - @nextclaw/channel-extension-wecom@0.1.1
  - @nextclaw/channel-extension-weixin@0.1.12
  - @nextclaw/channel-extension-whatsapp@0.1.1
  - @nextclaw/core@0.12.25
  - @nextclaw/kernel@0.1.15
  - @nextclaw/mcp@0.1.90
  - @nextclaw/ncp@0.5.18
  - @nextclaw/ncp-agent-runtime@0.3.29
  - @nextclaw/ncp-mcp@0.1.92
  - @nextclaw/ncp-toolkit@0.5.23
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18
  - @nextclaw/remote@0.1.103
  - @nextclaw/runtime@0.2.57
  - @nextclaw/server@0.12.26
  - @nextclaw/shared@0.1.12

## 0.1.18-beta.7

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.7
  - @nextclaw/channel-extension-discord@0.1.1-beta.7
  - @nextclaw/channel-extension-email@0.1.1-beta.7
  - @nextclaw/channel-extension-feishu@0.1.9-beta.7
  - @nextclaw/channel-extension-qq@0.1.6-beta.7
  - @nextclaw/channel-extension-slack@0.1.1-beta.7
  - @nextclaw/channel-extension-telegram@0.1.1-beta.7
  - @nextclaw/channel-extension-wecom@0.1.1-beta.7
  - @nextclaw/channel-extension-weixin@0.1.12-beta.7
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.7
  - @nextclaw/core@0.12.25-beta.7
  - @nextclaw/kernel@0.1.15-beta.7
  - @nextclaw/mcp@0.1.90-beta.7
  - @nextclaw/ncp@0.5.18-beta.7
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.7
  - @nextclaw/ncp-mcp@0.1.92-beta.7
  - @nextclaw/ncp-toolkit@0.5.23-beta.7
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.7
  - @nextclaw/remote@0.1.103-beta.7
  - @nextclaw/runtime@0.2.57-beta.7
  - @nextclaw/server@0.12.26-beta.7
  - @nextclaw/shared@0.1.12-beta.7

## 0.1.18-beta.6

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.6
  - @nextclaw/channel-extension-discord@0.1.1-beta.6
  - @nextclaw/channel-extension-email@0.1.1-beta.6
  - @nextclaw/channel-extension-feishu@0.1.9-beta.6
  - @nextclaw/channel-extension-qq@0.1.6-beta.6
  - @nextclaw/channel-extension-slack@0.1.1-beta.6
  - @nextclaw/channel-extension-telegram@0.1.1-beta.6
  - @nextclaw/channel-extension-wecom@0.1.1-beta.6
  - @nextclaw/channel-extension-weixin@0.1.12-beta.6
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.6
  - @nextclaw/core@0.12.25-beta.6
  - @nextclaw/kernel@0.1.15-beta.6
  - @nextclaw/mcp@0.1.90-beta.6
  - @nextclaw/ncp@0.5.18-beta.6
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.6
  - @nextclaw/ncp-mcp@0.1.92-beta.6
  - @nextclaw/ncp-toolkit@0.5.23-beta.6
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.6
  - @nextclaw/remote@0.1.103-beta.6
  - @nextclaw/runtime@0.2.57-beta.6
  - @nextclaw/server@0.12.26-beta.6
  - @nextclaw/shared@0.1.12-beta.6

## 0.1.18-beta.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.5
  - @nextclaw/channel-extension-discord@0.1.1-beta.5
  - @nextclaw/channel-extension-email@0.1.1-beta.5
  - @nextclaw/channel-extension-feishu@0.1.9-beta.5
  - @nextclaw/channel-extension-qq@0.1.6-beta.5
  - @nextclaw/channel-extension-slack@0.1.1-beta.5
  - @nextclaw/channel-extension-telegram@0.1.1-beta.5
  - @nextclaw/channel-extension-wecom@0.1.1-beta.5
  - @nextclaw/channel-extension-weixin@0.1.12-beta.5
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.5
  - @nextclaw/core@0.12.25-beta.5
  - @nextclaw/kernel@0.1.15-beta.5
  - @nextclaw/mcp@0.1.90-beta.5
  - @nextclaw/ncp@0.5.18-beta.5
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.5
  - @nextclaw/ncp-mcp@0.1.92-beta.5
  - @nextclaw/ncp-toolkit@0.5.23-beta.5
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.5
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.5
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.5
  - @nextclaw/remote@0.1.103-beta.5
  - @nextclaw/runtime@0.2.57-beta.5
  - @nextclaw/server@0.12.26-beta.5
  - @nextclaw/shared@0.1.12-beta.5

## 0.1.18-beta.4

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.4
  - @nextclaw/channel-extension-discord@0.1.1-beta.4
  - @nextclaw/channel-extension-email@0.1.1-beta.4
  - @nextclaw/channel-extension-feishu@0.1.9-beta.4
  - @nextclaw/channel-extension-qq@0.1.6-beta.4
  - @nextclaw/channel-extension-slack@0.1.1-beta.4
  - @nextclaw/channel-extension-telegram@0.1.1-beta.4
  - @nextclaw/channel-extension-wecom@0.1.1-beta.4
  - @nextclaw/channel-extension-weixin@0.1.12-beta.4
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.4
  - @nextclaw/core@0.12.25-beta.4
  - @nextclaw/kernel@0.1.15-beta.4
  - @nextclaw/mcp@0.1.90-beta.4
  - @nextclaw/ncp@0.5.18-beta.4
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.4
  - @nextclaw/ncp-mcp@0.1.92-beta.4
  - @nextclaw/ncp-toolkit@0.5.23-beta.4
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.4
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.4
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.4
  - @nextclaw/remote@0.1.103-beta.4
  - @nextclaw/runtime@0.2.57-beta.4
  - @nextclaw/server@0.12.26-beta.4
  - @nextclaw/shared@0.1.12-beta.4

## 0.1.18-beta.3

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.3
  - @nextclaw/channel-extension-discord@0.1.1-beta.3
  - @nextclaw/channel-extension-email@0.1.1-beta.3
  - @nextclaw/channel-extension-feishu@0.1.9-beta.3
  - @nextclaw/channel-extension-qq@0.1.6-beta.3
  - @nextclaw/channel-extension-slack@0.1.1-beta.3
  - @nextclaw/channel-extension-telegram@0.1.1-beta.3
  - @nextclaw/channel-extension-wecom@0.1.1-beta.3
  - @nextclaw/channel-extension-weixin@0.1.12-beta.3
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.3
  - @nextclaw/core@0.12.25-beta.3
  - @nextclaw/kernel@0.1.15-beta.3
  - @nextclaw/mcp@0.1.90-beta.3
  - @nextclaw/ncp@0.5.18-beta.3
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.3
  - @nextclaw/ncp-mcp@0.1.92-beta.3
  - @nextclaw/ncp-toolkit@0.5.23-beta.3
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.3
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.3
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.3
  - @nextclaw/remote@0.1.103-beta.3
  - @nextclaw/runtime@0.2.57-beta.3
  - @nextclaw/server@0.12.26-beta.3
  - @nextclaw/shared@0.1.12-beta.3

## 0.1.18-beta.2

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.2
  - @nextclaw/channel-extension-discord@0.1.1-beta.2
  - @nextclaw/channel-extension-email@0.1.1-beta.2
  - @nextclaw/channel-extension-feishu@0.1.9-beta.2
  - @nextclaw/channel-extension-qq@0.1.6-beta.2
  - @nextclaw/channel-extension-slack@0.1.1-beta.2
  - @nextclaw/channel-extension-telegram@0.1.1-beta.2
  - @nextclaw/channel-extension-wecom@0.1.1-beta.2
  - @nextclaw/channel-extension-weixin@0.1.12-beta.2
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.2
  - @nextclaw/core@0.12.25-beta.2
  - @nextclaw/kernel@0.1.15-beta.2
  - @nextclaw/mcp@0.1.90-beta.2
  - @nextclaw/ncp@0.5.18-beta.2
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.2
  - @nextclaw/ncp-mcp@0.1.92-beta.2
  - @nextclaw/ncp-toolkit@0.5.23-beta.2
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.2
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.2
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.2
  - @nextclaw/remote@0.1.103-beta.2
  - @nextclaw/runtime@0.2.57-beta.2
  - @nextclaw/server@0.12.26-beta.2
  - @nextclaw/shared@0.1.12-beta.2

## 0.1.18-beta.1

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-agent-runtime-next
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.1
  - @nextclaw/channel-extension-discord@0.1.1-beta.1
  - @nextclaw/channel-extension-email@0.1.1-beta.1
  - @nextclaw/channel-extension-feishu@0.1.9-beta.1
  - @nextclaw/channel-extension-qq@0.1.6-beta.1
  - @nextclaw/channel-extension-slack@0.1.1-beta.1
  - @nextclaw/channel-extension-telegram@0.1.1-beta.1
  - @nextclaw/channel-extension-wecom@0.1.1-beta.1
  - @nextclaw/channel-extension-weixin@0.1.12-beta.1
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.1
  - @nextclaw/core@0.12.25-beta.1
  - @nextclaw/kernel@0.1.15-beta.1
  - @nextclaw/mcp@0.1.90-beta.1
  - @nextclaw/ncp@0.5.18-beta.1
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.1
  - @nextclaw/ncp-mcp@0.1.92-beta.1
  - @nextclaw/ncp-toolkit@0.5.23-beta.1
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.1
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.1
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.1
  - @nextclaw/remote@0.1.103-beta.1
  - @nextclaw/runtime@0.2.57-beta.1
  - @nextclaw/server@0.12.26-beta.1
  - @nextclaw/shared@0.1.12-beta.1

## 0.1.18-beta.0

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-dingtalk
  - @nextclaw/channel-extension-discord
  - @nextclaw/channel-extension-email
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-slack
  - @nextclaw/channel-extension-telegram
  - @nextclaw/channel-extension-wecom
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-extension-whatsapp
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-dingtalk@0.1.1-beta.0
  - @nextclaw/channel-extension-discord@0.1.1-beta.0
  - @nextclaw/channel-extension-email@0.1.1-beta.0
  - @nextclaw/channel-extension-feishu@0.1.9-beta.0
  - @nextclaw/channel-extension-qq@0.1.6-beta.0
  - @nextclaw/channel-extension-slack@0.1.1-beta.0
  - @nextclaw/channel-extension-telegram@0.1.1-beta.0
  - @nextclaw/channel-extension-wecom@0.1.1-beta.0
  - @nextclaw/channel-extension-weixin@0.1.12-beta.0
  - @nextclaw/channel-extension-whatsapp@0.1.1-beta.0
  - @nextclaw/core@0.12.25-beta.0
  - @nextclaw/kernel@0.1.15-beta.0
  - @nextclaw/mcp@0.1.90-beta.0
  - @nextclaw/ncp@0.5.18-beta.0
  - @nextclaw/ncp-agent-runtime@0.3.29-beta.0
  - @nextclaw/ncp-mcp@0.1.92-beta.0
  - @nextclaw/ncp-toolkit@0.5.23-beta.0
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.17-beta.0
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.17-beta.0
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.18-beta.0
  - @nextclaw/remote@0.1.103-beta.0
  - @nextclaw/runtime@0.2.57-beta.0
  - @nextclaw/server@0.12.26-beta.0
  - @nextclaw/shared@0.1.12-beta.0

## 0.1.17

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.8
  - @nextclaw/channel-extension-qq@0.1.5
  - @nextclaw/channel-extension-weixin@0.1.11
  - @nextclaw/core@0.12.24
  - @nextclaw/kernel@0.1.14
  - @nextclaw/mcp@0.1.89
  - @nextclaw/ncp@0.5.17
  - @nextclaw/ncp-agent-runtime@0.3.28
  - @nextclaw/ncp-mcp@0.1.91
  - @nextclaw/ncp-toolkit@0.5.22
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.16
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.16
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.17
  - @nextclaw/openclaw-compat@1.0.24
  - @nextclaw/remote@0.1.102
  - @nextclaw/runtime@0.2.56
  - @nextclaw/server@0.12.25
  - @nextclaw/shared@0.1.11

## 0.1.16

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.7
  - @nextclaw/channel-extension-qq@0.1.4
  - @nextclaw/channel-extension-weixin@0.1.10
  - @nextclaw/core@0.12.23
  - @nextclaw/kernel@0.1.13
  - @nextclaw/mcp@0.1.88
  - @nextclaw/ncp@0.5.16
  - @nextclaw/ncp-agent-runtime@0.3.27
  - @nextclaw/ncp-mcp@0.1.90
  - @nextclaw/ncp-toolkit@0.5.21
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.15
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.15
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.16
  - @nextclaw/openclaw-compat@1.0.23
  - @nextclaw/remote@0.1.101
  - @nextclaw/runtime@0.2.55
  - @nextclaw/server@0.12.24
  - @nextclaw/shared@0.1.10

## 0.1.15

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.6
  - @nextclaw/channel-extension-qq@0.1.3
  - @nextclaw/channel-extension-weixin@0.1.9
  - @nextclaw/core@0.12.22
  - @nextclaw/kernel@0.1.12
  - @nextclaw/mcp@0.1.87
  - @nextclaw/ncp@0.5.15
  - @nextclaw/ncp-agent-runtime@0.3.26
  - @nextclaw/ncp-mcp@0.1.89
  - @nextclaw/ncp-toolkit@0.5.20
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.14
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.14
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.15
  - @nextclaw/openclaw-compat@1.0.22
  - @nextclaw/remote@0.1.100
  - @nextclaw/runtime@0.2.54
  - @nextclaw/server@0.12.23
  - @nextclaw/shared@0.1.9

## 0.1.14

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.5
  - @nextclaw/channel-extension-qq@0.1.2
  - @nextclaw/channel-extension-weixin@0.1.8
  - @nextclaw/core@0.12.21
  - @nextclaw/kernel@0.1.11
  - @nextclaw/mcp@0.1.86
  - @nextclaw/ncp@0.5.14
  - @nextclaw/ncp-agent-runtime@0.3.25
  - @nextclaw/ncp-mcp@0.1.88
  - @nextclaw/ncp-toolkit@0.5.19
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.13
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.13
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.14
  - @nextclaw/openclaw-compat@1.0.21
  - @nextclaw/remote@0.1.99
  - @nextclaw/runtime@0.2.53
  - @nextclaw/server@0.12.22
  - @nextclaw/shared@0.1.8

## 0.1.13

### Patch Changes

- Updated dependencies
  - @nextclaw/ncp-agent-runtime@0.3.24
  - @nextclaw/ncp-toolkit@0.5.18
  - @nextclaw/kernel@0.1.10
  - @nextclaw/remote@0.1.98
  - @nextclaw/server@0.12.21

## 0.1.12

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-qq
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.4
  - @nextclaw/channel-extension-qq@0.1.1
  - @nextclaw/channel-extension-weixin@0.1.7
  - @nextclaw/core@0.12.20
  - @nextclaw/kernel@0.1.9
  - @nextclaw/mcp@0.1.85
  - @nextclaw/ncp@0.5.13
  - @nextclaw/ncp-agent-runtime@0.3.23
  - @nextclaw/ncp-mcp@0.1.87
  - @nextclaw/ncp-toolkit@0.5.18
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.12
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.12
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.13
  - @nextclaw/openclaw-compat@1.0.20
  - @nextclaw/remote@0.1.97
  - @nextclaw/runtime@0.2.52
  - @nextclaw/server@0.12.20
  - @nextclaw/shared@0.1.7

## 0.1.11

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.3
  - @nextclaw/channel-extension-weixin@0.1.6
  - @nextclaw/core@0.12.19
  - @nextclaw/kernel@0.1.8
  - @nextclaw/mcp@0.1.84
  - @nextclaw/ncp@0.5.12
  - @nextclaw/ncp-agent-runtime@0.3.22
  - @nextclaw/ncp-http-agent-server@0.3.24
  - @nextclaw/ncp-mcp@0.1.86
  - @nextclaw/ncp-toolkit@0.5.17
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.11
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.12
  - @nextclaw/openclaw-compat@1.0.19
  - @nextclaw/remote@0.1.96
  - @nextclaw/runtime@0.2.51
  - @nextclaw/server@0.12.19
  - @nextclaw/shared@0.1.6

## 0.1.10

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.2
  - @nextclaw/channel-extension-weixin@0.1.5
  - @nextclaw/core@0.12.18
  - @nextclaw/kernel@0.1.7
  - @nextclaw/mcp@0.1.83
  - @nextclaw/ncp@0.5.11
  - @nextclaw/ncp-agent-runtime@0.3.21
  - @nextclaw/ncp-http-agent-server@0.3.23
  - @nextclaw/ncp-mcp@0.1.85
  - @nextclaw/ncp-toolkit@0.5.16
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.10
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.11
  - @nextclaw/openclaw-compat@1.0.18
  - @nextclaw/remote@0.1.95
  - @nextclaw/runtime@0.2.50
  - @nextclaw/server@0.12.18
  - @nextclaw/shared@0.1.5

## 0.1.9

### Patch Changes

- Make `nextclaw update` apply downloaded runtime updates by default, with `--download-only` for staging without switching.

## 0.1.8

### Patch Changes

- Auto-generated full public stable release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-feishu
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-feishu@0.1.1
  - @nextclaw/channel-extension-weixin@0.1.4
  - @nextclaw/core@0.12.17
  - @nextclaw/kernel@0.1.6
  - @nextclaw/mcp@0.1.82
  - @nextclaw/ncp@0.5.10
  - @nextclaw/ncp-agent-runtime@0.3.20
  - @nextclaw/ncp-http-agent-server@0.3.22
  - @nextclaw/ncp-mcp@0.1.84
  - @nextclaw/ncp-toolkit@0.5.15
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.9
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.10
  - @nextclaw/openclaw-compat@1.0.17
  - @nextclaw/remote@0.1.94
  - @nextclaw/runtime@0.2.49
  - @nextclaw/server@0.12.17
  - @nextclaw/shared@0.1.4

## 0.1.7

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-weixin@0.1.3
  - @nextclaw/core@0.12.16
  - @nextclaw/kernel@0.1.5
  - @nextclaw/mcp@0.1.81
  - @nextclaw/ncp@0.5.9
  - @nextclaw/ncp-agent-runtime@0.3.19
  - @nextclaw/ncp-http-agent-server@0.3.21
  - @nextclaw/ncp-mcp@0.1.83
  - @nextclaw/ncp-toolkit@0.5.14
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.8
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.9
  - @nextclaw/openclaw-compat@1.0.16
  - @nextclaw/remote@0.1.93
  - @nextclaw/runtime@0.2.48
  - @nextclaw/server@0.12.16
  - @nextclaw/shared@0.1.3

## 0.1.6

### Patch Changes

- Fix runtime update status messaging and centralize packaged distribution metadata for npm runtime updates.

## 0.1.5

### Patch Changes

- Auto-generated full public beta release batch.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-weixin@0.1.2
  - @nextclaw/core@0.12.15
  - @nextclaw/kernel@0.1.4
  - @nextclaw/mcp@0.1.80
  - @nextclaw/ncp@0.5.8
  - @nextclaw/ncp-agent-runtime@0.3.18
  - @nextclaw/ncp-http-agent-server@0.3.20
  - @nextclaw/ncp-mcp@0.1.82
  - @nextclaw/ncp-toolkit@0.5.13
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.7
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.8
  - @nextclaw/openclaw-compat@1.0.15
  - @nextclaw/remote@0.1.92
  - @nextclaw/runtime@0.2.47
  - @nextclaw/server@0.12.15
  - @nextclaw/shared@0.1.2

## 0.1.4

### Patch Changes

- Ensure published npm installs discover the packaged runtime update public key when running `nextclaw update`.

## 0.1.3

### Patch Changes

- Keep the published NextClaw CLI version and runtime update launcher version owned by the nextclaw package when using the service package runtime.

## 0.1.2

### Patch Changes

- Fix the published npm launcher fallback so the service-hosted launcher starts the packaged nextclaw app entrypoint.

## 0.1.1

### Patch Changes

- Stable minor release for the NextClaw npm package, with patch releases for the workspace dependency closure.

  Packages:
  - @nextclaw/agent-chat
  - @nextclaw/agent-chat-ui
  - @nextclaw/app-runtime
  - @nextclaw/app-sdk
  - @nextclaw/channel-extension-weixin
  - @nextclaw/channel-plugin-dingtalk
  - @nextclaw/channel-plugin-discord
  - @nextclaw/channel-plugin-email
  - @nextclaw/channel-plugin-feishu
  - @nextclaw/channel-plugin-mochat
  - @nextclaw/channel-plugin-qq
  - @nextclaw/channel-plugin-slack
  - @nextclaw/channel-plugin-telegram
  - @nextclaw/channel-plugin-wecom
  - @nextclaw/channel-plugin-whatsapp
  - @nextclaw/channel-runtime
  - @nextclaw/client-sdk
  - @nextclaw/companion
  - @nextclaw/core
  - @nextclaw/extension-sdk
  - @nextclaw/feishu-core
  - @nextclaw/kernel
  - @nextclaw/mcp
  - @nextclaw/ncp
  - @nextclaw/ncp-agent-runtime
  - @nextclaw/ncp-http-agent-client
  - @nextclaw/ncp-http-agent-server
  - @nextclaw/ncp-mcp
  - @nextclaw/ncp-react
  - @nextclaw/ncp-react-ui
  - @nextclaw/ncp-toolkit
  - @nextclaw/nextclaw-hermes-acp-bridge
  - @nextclaw/nextclaw-narp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-narp-runtime-codex-sdk
  - @nextclaw/nextclaw-narp-stdio-runtime-wrapper
  - @nextclaw/nextclaw-ncp-runtime-adapter-hermes-http
  - @nextclaw/nextclaw-ncp-runtime-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-http-client
  - @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk
  - @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk
  - @nextclaw/nextclaw-ncp-runtime-stdio-client
  - @nextclaw/openclaw-compat
  - @nextclaw/remote
  - @nextclaw/runtime
  - @nextclaw/server
  - @nextclaw/service
  - @nextclaw/shared
  - @nextclaw/ui
  - nextclaw

- Updated dependencies
  - @nextclaw/channel-extension-weixin@0.1.1
  - @nextclaw/core@0.12.14
  - @nextclaw/kernel@0.1.3
  - @nextclaw/mcp@0.1.79
  - @nextclaw/ncp@0.5.7
  - @nextclaw/ncp-agent-runtime@0.3.17
  - @nextclaw/ncp-http-agent-server@0.3.19
  - @nextclaw/ncp-mcp@0.1.81
  - @nextclaw/ncp-toolkit@0.5.12
  - @nextclaw/nextclaw-hermes-acp-bridge@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-http-client@0.1.6
  - @nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.7
  - @nextclaw/openclaw-compat@1.0.14
  - @nextclaw/remote@0.1.91
  - @nextclaw/runtime@0.2.46
  - @nextclaw/server@0.12.14
