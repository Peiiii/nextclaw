# 验证记录

## 单元测试

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- --run src/providers/chat-completions-normalizer.test.ts
```

结果：

- `3/3` 用例通过

## build / lint / tsc

全仓命令：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm build
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm tsc
```

结果：

- 全仓 `build` 失败（与本次改动无关的既有改动导致）：
  - `packages/nextclaw-server/src/ui/config.ts` 中 `ProviderSpec.isCustom` 类型不匹配（`TS2339`）
- 针对本次变更的受影响包验证通过：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc
```

- `nextclaw-core` 的 `build/lint/tsc` 全部通过（lint 仅历史 warning，无新增 error）

## 冒烟测试（真实运行）

目的：验证“非标准 payload 不再报 `reading '0'`”

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsx /tmp/nextclaw-openai-invalid-payload-smoke.ts
```

观察点：

- 输出 `SMOKE_OK_INVALID_PAYLOAD_HANDLED`
- 表示非标准 payload 已被正确拦截，不再触发 `choices[0]` 崩溃。
