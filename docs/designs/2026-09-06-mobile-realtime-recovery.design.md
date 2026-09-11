# 手机浏览器实时连接恢复设计

## 背景

Linear NC-168 记录了手机浏览器连接 VPS 上的 NextClaw 后经常断联，且只能刷新页面恢复。当前浏览器实时传输仅在 WebSocket 触发 `close` 时安排重连；手机锁屏、切后台、网络切换或中间代理静默回收连接时，浏览器可能继续把已经不可用的 socket 报告为 `OPEN`，因而不会进入现有重连路径。

Linear NC-178 的后续现场反馈表明，首版恢复合同仍有两个缺口：移动浏览器从冻结或 BFCache 恢复时不保证触发 `visibilitychange`，可能只派发 `pageshow` 或窗口 `focus`；远程 transport 若在后台冻结前停在 `CONNECTING`，恢复请求会被旧的连接 promise 拦截，继续等待被冻结的超时。两者都会让用户在回到页面后仍面对数秒到数十秒的静止内容。

聊天运行流已经拥有自己的 SSE 中断恢复。本设计只处理页面级 AppEvent WebSocket，不改变聊天 SSE、服务端协议或远程连接器协议。

## 可观察合同

- 页面回到前台时，只要仍有实时订阅，就主动淘汰可能假活的浏览器 WebSocket 并建立新连接。
- `visibilitychange`、BFCache 恢复的 `pageshow`、窗口 `focus` 任一能够证明页面已回到可交互前台时，都触发同一恢复动作；普通首次加载的 `pageshow` 不得重复连接，同一轮恢复产生的事件簇不得连续抖动连接。
- 浏览器从离线恢复为在线且页面可见时，执行相同恢复动作。
- 旧 socket 即使仍停在 `CONNECTING`，也不得阻止前台恢复；旧连接 promise 必须明确失败，不能遗留永不 settle 的调用方。
- 旧 socket 延迟到达的 `close` 不得清空或再次重连已经替换的新 socket。
- 新 socket 建立后继续发送现有 `connection.open`，由既有 consumer 刷新会话列表和运行状态；不新增第二套补数逻辑。
- 最后一个实时订阅释放后，浏览器生命周期监听一并释放。

## 主链路与 owner

```text
手机锁屏/切后台或网络中断
  -> document.visibilitychange / window.pageshow / window.focus / window.online
  -> BrowserRealtimeRecoveryService（浏览器恢复触发 owner）
  -> LocalRealtimeGateway 或 RemoteSessionMultiplexTransport（socket owner）
  -> 淘汰旧 socket 并立即 connect/ensureSocket
  -> connection.open
  -> useAppEventConsumers
  -> 刷新 ncp-sessions 与运行状态
```

恢复 service 只拥有浏览器事件监听生命周期，不读取 transport 内部字段，也不建立 socket。两个 transport 继续完整拥有各自 socket、请求、流和重连状态。

## 方案取舍

采用前台/在线恢复时主动换新连接：它命中手机浏览器恢复边界，不需要扩展协议，也不依赖后台定时器能够运行。浏览器恢复 service 对同一轮前台事件簇做短暂的 leading-edge 去重，第一次信号立即恢复，紧随其后的 `focus`、`pageshow` 或 `online` 不重复换 socket；去重窗口结束后的独立网络恢复仍可再次触发。

不采用应用层心跳作为本次主方案：心跳需要同时定义直连 `/ws` 与远程 `/_remote/ws` 的帧协议、服务端回应和超时语义；手机后台又可能冻结定时器，不能单独保证恢复。若后续有“页面持续前台但代理静默丢连接”的独立证据，再按协议级设计处理。

不采用整页 reload：它会破坏当前 UI 临时状态，并把 transport owner 的缺口转嫁给页面。

## 状态与失败恢复

| 场景 | 旧 socket | 触发 | 结果 |
| --- | --- | --- | --- |
| 首次订阅 | 无 | subscribe | 正常建立连接并注册恢复监听 |
| 后台恢复 | `OPEN` 但可能假活 | 页面变为 visible | 关闭旧连接并立即建立新连接 |
| 冻结/BFCache 恢复 | 任意 | persisted pageshow 或 focus 且页面 visible | 关闭旧连接并立即建立新连接 |
| 后台冻结了建连 | `CONNECTING` | 任一有效前台恢复信号 | 清理旧超时、拒绝旧 promise、关闭旧 socket 并立即重新建连 |
| 网络恢复 | 任意非手动关闭状态 | online 且页面 visible | 关闭/取消旧尝试并立即建立新连接 |
| 同一轮恢复事件簇 | 新连接正在建立 | 紧邻的 visible/pageshow/focus/online | 去重，不连续替换刚创建的 socket |
| hidden 时 online | 任意 | online 但页面 hidden | 不抢跑；等待 visible 后恢复 |
| 旧 socket 延迟 close | 新 socket 已存在 | stale close | 忽略，不覆盖当前 socket |
| 无订阅 | 任意 | 生命周期事件 | 不恢复；监听已释放 |

远程 multiplex 上连接中断时，仍沿现有合同使 pending request/stream 失败；本次不尝试自动重放可能有副作用的请求或流。

## 可复用测试资产

测试使用可控 Mock WebSocket 保留“服务端已不可达、浏览器仍报告 `OPEN`”的故障状态，不依赖真实手机、运营商网络或等待 TCP 超时：

1. 建立第一个 socket 并保持 `OPEN`，不触发 `close`。
2. 把文档状态从 hidden 切回 visible，分别派发 `visibilitychange`、`pageshow` 与 `focus`。
3. 断言旧 socket 被关闭且创建第二个 socket。
4. 让旧 socket 延迟触发 `close`，断言不会创建第三个 socket 或清空新连接。
5. 对恢复事件簇去重、`online`、hidden 抑制、取消订阅清理，以及直连和远程两种 transport 重复同一合同。
6. 让远程 socket 停在 `CONNECTING`，恢复后断言旧 promise 立即失败且新 socket 无需等待旧超时便已创建。

这组测试是 NC-168 的修前复现和长期回归入口；未来调整实时连接恢复时应继续复用该故障模型。

## 范围与非目标

- 范围：`@nextclaw/ui` 的浏览器直连和远程 multiplex WebSocket。
- 不修改服务端 WebSocket 协议、认证或消息格式。
- 不自动重放远程 pending request/stream，避免重复执行。
- 不为本次问题增加用户配置项、兼容开关或 legacy 路径。
- 用户可见能力变化需要 changeset 和中英文用户文档说明；无需新增 CLI，因为这是浏览器连接生命周期行为，没有可调用的命令语义。

## 最小验证

- 修前复现测试先失败，且失败点为假活 socket 未被替换。
- 恢复 service、直连 transport、远程 transport 的定向 Vitest 通过。
- `@nextclaw/ui` TypeScript 编译通过。
- diff-only maintainability 检查通过。
