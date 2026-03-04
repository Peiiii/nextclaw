# v0.0.6 Validation

## 执行命令

- `export PATH=/opt/homebrew/bin:$PATH; pnpm -C packages/nextclaw-ui tsc`
- `export PATH=/opt/homebrew/bin:$PATH; pnpm -C packages/nextclaw-ui build`

## 结果

- TypeScript 编译通过。
- UI 构建通过。

## 行为验证点

1. 点击停止后，会话不再出现 user+assistant 整段重复。
2. 发送失败时，输入区域可见错误文本（例如后端余额/鉴权报错）。
3. 后端不支持 capabilities 时，发送仍可继续，停止能力自动降级。
