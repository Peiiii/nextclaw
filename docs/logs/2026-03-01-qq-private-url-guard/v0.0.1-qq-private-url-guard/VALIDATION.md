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
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-channel-runtime exec tsx --eval "import { QQChannel } from './src/channels/qq.ts'; const bus={publishInbound: async ()=>{}} as any; const c = new QQChannel({ appId:'a', secret:'b', markdownSupport:true } as any, bus); const err = new Error('Request failed with code(40034028): 请求参数不允许包含url USER.md'); const out = (c as any).toQqSafeText('Source: USER.md\\n详情见 https://example.com', err); console.log(out);"
```

验收点：

1. `USER.md` 被清洗为安全占位文本。
2. 真实 URL 被清洗为安全占位文本。

冒烟结果：

- 输出：
  - `Source: [file]`
  - `详情见 [link]`
