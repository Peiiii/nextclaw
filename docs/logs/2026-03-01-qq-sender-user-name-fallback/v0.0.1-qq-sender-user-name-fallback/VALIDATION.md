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
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-channel-runtime exec tsx --eval "import { QQChannel } from './src/channels/qq.ts'; const bus={publishInbound: async ()=>{}} as any; const c = new QQChannel({ appId:'a', secret:'b' } as any, bus); const name=(c as any).resolveSenderName({sender:{user_name:'大哥-测试中'}}); const line=(c as any).decorateSpeakerPrefix({content:'测试', messageType:'private', senderId:'u1', senderName:name}); console.log(name); console.log(line);"
```

验收点：

1. `resolveSenderName` 能返回 `user_name`。
2. 私聊入模文本带 `name=大哥-测试中`。
