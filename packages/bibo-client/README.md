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
| `chat(message, onEvent)` | 逐帧通知 `accepted`、`delta`、`saving`、`committed`；只有收到提交事件才成功结束 |
| `cancel(runId)` / `reset()` | 停止指定生成、清空个人空间 |

服务端报错、响应无效或流中断时抛出 `BiboClientError`；HTTP 错误包含 `status`。调用方应在失败后重新读取 `history()` 判断是否已保存，不能把部分 delta 当作正式记录。浏览器持有 HttpOnly 登录 Cookie，client 不读取或保存 Token。这个包只支持 Bibo 同站点网页 API；外部认证、CORS 与公开 API 版本合同尚未定义。

测试时可向构造函数传入 `{ fetch: fakeFetch }`。运行 `pnpm -C packages/bibo-client tsc` 与 `pnpm -C packages/bibo-client test`。
