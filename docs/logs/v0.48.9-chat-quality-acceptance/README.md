# 聊天质量与自主验收

## 迭代完成说明

批次进度与验收账本见[计划](../../plans/2026-09-08-chat-quality-four-fixes.plan.md)。本记录随每项交付更新，不代表四项已全部完成。

- NC-169：手机用户头像和 flex 占位隐藏，桌面保持显示；提交 `665b10425` 已本地合入。
- NC-167：`message.completed` 清空 streaming 后，`run.finished/error` 原本只收尾 streaming，漏掉已完成消息的生命周期。真实顺序测试修前两条失败，修后按明确消息 ID 定位 assistant，在同一 owner 保留结束时间。设计见[完成时序](../../designs/2026-09-08-chat-completion-timing.design.md)。
- NC-170：页面将实时 isRunning 与会话列表缓存 running 取 OR，缓存滞后时覆盖了实时终态。修前 stale-cache 测试失败，修后页面只消费已负责 seed/live/reconnect 的 agent owner，移除 10 行重复派生。
- NC-168：主干已有 `e6de142d0` 修复，不重复实现。本批次以该提交父版本的真实 transport 代码重跑：假活 OPEN + 前台恢复，直连/远程各一条稳定失败；恢复当前代码后通过，并补第二次恢复与禁止请求重放的回归。

## 测试/验证/验收方式

- NC-169：真实共享组件与产品 CSS 在 Chrome 375/767/768/1280px 下用户头像占位分别 0/0/32/32px；助手均 32px，无水平溢出；截图已检查。agent-chat-ui tsc、定向 lint、维护性与治理通过。
- NC-167：toolkit agent 47 测试通过；UI 处理摘要 5 测试通过，包括真实状态 owner 输出“已处理 3m 51s”；kernel journal recovery 5 测试通过，包括事件落盘、冷重载与分页读取的 lifecycle 一致。
- toolkit/UI/kernel tsc 通过；隔离工作区补足同源码构建声明后运行，toolkit 使用本次源码重新构建。
- NC-170：4 个相关 UI 测试文件共 59 用例通过，覆盖旧缓存不覆盖终态、消息完成后任务仍可运行、RunFinished 后退出 busy，以及现有 hydration/commands/controller 行为；UI tsc、定向 lint 通过。未改变组件 type/key/父级和焦点，既有流式 DOM 身份用例通过。
- 修前失败日志、临时截图在隔离工作区 `.local/chat-quality/`；不进入用户发布素材。
- NC-168：6 个 UI 文件共 32 用例通过，覆盖 WS 生命周期恢复、连接事件 consumer、会话缓存与连续两次聊天断流后补消息并继续发送；HTTP agent client 9 用例覆盖 SSE 无数据超时与注释心跳。
- NC-168 真实浏览器：Chrome 手机视口 + 实际 LocalAppTransport + 本地 WebSocket server，两次 offline/online 后共有 3 次连接，收到 recovered-1/2/3 各一次；页面 URL 与草稿保持不变。结果：`.local/chat-quality/nc168-browser.json`。
- 环境界限：没有实测物理 iOS/Android、运营商及所有 VPS 代理；SSE 静默断流沿已有 70 秒 idle timeout 恢复，不能将 WS 前台换连解释为所有流瞬间恢复。未改现有用户服务或部署。

## 发布/部署方式

每项独立提交后合入本地 master，不推送、不发布、不重启用户实例。NC-168 的已有部署不属于本批次操作。

## 用户/产品视角的验收步骤

1. 手机查看长用户消息，无右侧头像占位；桌面和助手头像正常。
2. 运行一条包含思考或工具过程的消息，结束后“已处理”显示耗时，刷新保留有时间记录的结果。
3. 无时间记录的旧消息不伪造耗时；失败状态不显示为成功。

## 可维护性总结汇总

NC-169 复用头像组件响应式 class。NC-167 复用 toolkit 状态 owner 和既有纯函数模块，删除重复 upsert；不引入新的生命周期 owner、UI 计时器或推测历史耗时。维护性门发现状态文件预算压力后，将纯定位函数放回现有 utils。

## NPM 包发布记录

`@nextclaw/agent-chat-ui`、`@nextclaw/ncp-toolkit`、`@nextclaw/ui` changeset 已准备，待统一发布；本批次未发布 NPM。

NC-168 只补测试与验收记录，不新增 changeset；已有修复的 changeset 继续保留。
