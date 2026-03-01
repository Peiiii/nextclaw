# Validation

## 自动验证

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
```

结果：

- `build` 通过。
- `lint` 通过（仅历史 warnings，无 errors）。
- `tsc` 通过。

## 冒烟测试

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-channel-runtime exec tsx --eval "import { QQChannel } from './src/channels/qq.ts'; const bus={publishInbound: async ()=>{}} as any; const channel = new QQChannel({ appId:'a', secret:'b' } as any, bus); const privateMsg=(channel as any).decorateSpeakerPrefix({ content:'你好', messageType:'private', senderId:'u123', senderName:'张三' }); console.log(privateMsg);"
```

验收点：

1. 私聊文本也包含 `speaker:user_id=...`。
2. 有昵称时包含 `name=...`。

冒烟结果：

- 输出示例：`[speaker:user_id=u123;name=张三] 你好`
