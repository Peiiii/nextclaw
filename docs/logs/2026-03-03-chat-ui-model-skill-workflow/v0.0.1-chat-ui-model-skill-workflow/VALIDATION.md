# Validation

## 执行时间
- 2026-03-03

## 执行命令

1. Build + TypeCheck
```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc
```

2. Lint（全量）
```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint
```

3. Lint（本次改动文件）
```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server exec eslint src/ui/router.ts src/ui/types.ts
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/lib/provider-models.ts src/components/config/ModelConfig.tsx src/components/chat/ChatPage.tsx src/components/chat/ChatConversationPanel.tsx src/components/chat/ChatInputBar.tsx src/components/chat/useChatStreamController.ts src/components/chat/SkillsPicker.tsx src/components/chat/ChatThread.tsx src/api/types.ts src/lib/i18n.ts
```

## 结果

- `build`：通过。
- `tsc`：通过。
- `lint`（全量）：失败，原因是仓库既有问题（非本次引入），含未使用变量与 max-lines 规则超限。
- `lint`（本次改动文件）：无 error，仅 `packages/nextclaw-server/src/ui/router.ts` 存在既有 max-lines warning。

## 冒烟测试（用户可见改动）

> 遵循规则：使用 `/tmp` 临时路径，不向仓库目录写入测试数据。

```bash
PATH=/opt/homebrew/bin:$PATH bash -lc 'cd /Users/peiwang/Projects/nextbot/packages/nextclaw-ui && pnpm exec vite preview --host 127.0.0.1 --port 4177 >/tmp/nextclaw-ui-preview.log 2>&1 & pid=$!; sleep 3; curl -fsS http://127.0.0.1:4177 > /tmp/nextclaw-ui-preview.html; kill $pid; wait $pid 2>/dev/null || true; rg -n "<title>|id=\"root\"" /tmp/nextclaw-ui-preview.html'
```

观察点：
- 页面可正常启动并返回 HTML。
- 存在 `<div id="root"></div>`，前端可挂载。
