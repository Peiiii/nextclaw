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
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-channel-runtime exec tsx --eval "import { QQChannel } from './src/channels/qq.ts'; const bus={publishInbound: async ()=>{}} as any; const c = new QQChannel({ appId:'a', secret:'b', markdownSupport:true } as any, bus); const out = (c as any).toQqSafeText('Source: USER.md\\n详情见 https://example.com', new Error('code(40034028): 请求参数不允许包含url USER.md')); console.log(out);"
```

验收点：

1. URL-like 文本会被清洗为可发送安全文本。
2. QQ 发送策略在代码中不再生成 markdown payload。

冒烟结果：

- 输出：
  - `Source: [file]`
  - `详情见 [link]`
