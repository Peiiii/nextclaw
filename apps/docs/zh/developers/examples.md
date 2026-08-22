# 示例

以下示例只使用当前 experimental public contract。

## Node.js 一次性任务

```ts
import { runNextclawTask } from '@nextclaw/harness';

const result = await runNextclawTask({ input: '检查仓库并输出风险摘要' });
console.log(result.text);
```

## 长生命周期 Harness

同一个 Harness 可以运行多次任务。每次省略 `sessionId` 都会创建新的 `exec:<uuid>` session；需要连续上下文时显式传入相同 session id。

```ts
import { NextclawHarness } from '@nextclaw/harness';

const harness = new NextclawHarness();
await harness.start();
try {
  const first = await harness.runTask({ input: '建立项目摘要', sessionId: 'project-review' });
  const second = await harness.runTask({ input: '基于刚才的摘要列出风险', sessionId: 'project-review' });
  console.log(first.text, second.text);
} finally {
  await harness.dispose();
}
```

## CI 与 JSONL

```bash
set -o pipefail
nextclaw exec --format jsonl --timeout 60000 "运行检查并解释结果" \
  > agent-events.jsonl
```

CI 可以逐行消费 `agent-events.jsonl`，并用进程退出码判断成功、输入错误、取消或运行失败。需要把上下文附加到 prompt 时，可通过 stdin 管道传入。
