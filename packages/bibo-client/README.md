# Bibo Client

`@nextclaw/bibo-client` 是 Bibo 托管网页的内部 TypeScript client，统一拥有同站点 `/api/*` 请求、响应类型和聊天流协议。它不依赖 React、Zustand、Cloudflare 或本地 `nextclaw` CLI。

```ts
import { BiboClient } from "@nextclaw/bibo-client";

const client = new BiboClient();
const user = await client.account();
const messages = await client.history();
await client.chat("你好", (event) => {
  if (event.name === "delta") console.log(event.value.text);
});
```

| 方法 | 合同 |
| --- | --- |
| `account()` / `history()` | 读取当前账号与已保存消息 |
| `sendCode(email)` / `register(email, password, code)` / `login(email, password)` / `logout()` | 使用现有同站点 Cookie 账号链路 |
| `chat(message, onEvent, sessionId?)` | 逐帧通知 `accepted`、`delta`、`saving`、`show-content`、`committed`；只有收到提交事件才成功结束 |
| `readFile({ id })` / `readFile({ path })` | 精确读取当前账号已登记的个人空间文件，并校验正文与元数据 |
| `cancel(runId)` / `reset()` | 停止指定生成、清空个人空间 |

服务端报错、响应无效或流中断时抛出 `BiboClientError`；HTTP 错误包含 `status`。调用方应在失败后重新读取 `history()` 判断是否已保存，不能把部分 delta 当作正式记录。浏览器持有 HttpOnly 登录 Cookie，client 不读取或保存 Token。这个包只支持 Bibo 同站点网页 API；外部认证、CORS 与公开 API 版本合同尚未定义。

测试时可向构造函数传入 `{ fetch: fakeFetch }`。运行 `pnpm -C packages/bibo-client tsc` 与 `pnpm -C packages/bibo-client test`。

`delta.value.blockId` 是可选的非空文本块 ID，来自内核实际文本块边界。同一 ID 的连续 delta 追加到同一块，新 ID 开始下一块；旧响应没有 ID 时作为单块展示。已提交消息的 `content` 按原顺序保留文本块和问题引用，刷新不重新按段落猜测边界。

`show-content` 使用 `BiboUiEvent` / `BiboShowContent` 类型，保留内核的文件展示目标：`value.target.payload` 包含 `path` 与可选的 `viewer`（`auto`、`source`、`rendered`），`value.sessionId` 标识来源会话。SDK 统一校验 SSE 和 JSON 响应；服务端保存成功后才发送展示事件。调用方等待 `chat()` 成功结束、确认会话仍然活跃，再通过 `readFile({ path })` 读取并交给已有查看器。事件不会包含文件正文，也不允许读取未登记文件或任意服务器路径。
