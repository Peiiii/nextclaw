# Session 列表接口性能修复方案

## 背景

本地首屏进入 NextClaw 时，`GET /api/ncp/sessions` 是几个初始接口里最慢的接口。实测环境中：

- 本地 session 文件数：2491 个。
- session 目录大小：约 253 MB。
- 无 `limit` 的 `/api/ncp/sessions` 响应大小：约 1.48 MB。
- 修复前 `GET /api/ncp/sessions?limit=5` 仍接近 1 秒，说明 limit 没有提前削减后端工作量。

这不是单纯“数据多”导致的表层问题，而是列表接口读模型和详情读模型耦合：列表摘要路径穿透到了完整 session 文件加载和 message 转换路径。

## 分层根因

### 1. UI transport 丢失 query

`@nextclaw/client-sdk` 已经为 `sessions.list({ limit })` 构造 query，但 `packages/nextclaw-ui` 的 transport bridge 只传了 `method/path/body/signal/timeoutMs`，没有把 `query` 带给实际请求。结果前端首屏声明请求 `limit=200`，真实请求却退化成 `/api/ncp/sessions` 全量列表。

### 2. SessionStore metadata 读取过重

`SessionStore.listSessions()` 只需要读取每个 `.jsonl` 的第一行 metadata，但实现使用：

```ts
readFileSync(path, "utf-8").split("\n")[0]
```

这会把每个 session 文件完整读入内存。当前本地数据下，仅为读取第一行 metadata 就扫描约 253 MB。

### 3. NcpSessionApi limit 位置过晚

`NcpSessionApi.listSessions()` 当前先遍历全部 session record，再对每个 session 执行 `getIfExists()`，并通过 `toNcpMessages()` 转换 messages 生成 summary，最后才 `applyLimit()`。

这导致 `?limit=5` 和全量请求一样会加载大量 session 内容。列表接口本应以 metadata 为主，详情接口才加载 messages。

## 推荐方案

本轮采取三步结构性修复，不引入新的 summary index / cache owner：

1. 先修 UI transport query 透传。
2. 再修 `SessionStore.listSessions()` 的 metadata 读取，让它只读第一行。
3. 再修 `NcpSessionApi.listSessions()`，先按 metadata 排序和 limit，再加载必要 session 生成当前 contract 需要的 summary。

## 为什么不直接做 summary index

summary index 是长期正确方向，但它需要定义持久化格式、迁移、回填、写入同步、删除失效和并发一致性。这属于第二阶段演进，不应混进当前明确 bugfix。当前三步可以先把首屏列表从“全量扫描 + 全量加载”降为“metadata 扫描 + 少量加载”，风险更小，验证也更直接。

## 验收标准

- 浏览器首屏请求必须带上 `limit`。
- `GET /api/ncp/sessions?limit=5` 不再接近全量接口耗时。
- `GET /api/ncp/sessions?limit=200` 耗时相对修复前大幅下降。
- `GET /api/ncp/sessions` 无 limit 时仍保持现有 contract，不在本轮改变全量语义。
- `GET /api/ncp/sessions/:id/messages`、session update/delete、realtime summary 语义不回退。

## 后续演进

第二阶段建议让 session summary 成为一等持久化读模型：

- 在 session 写入或追加消息时同步更新 summary metadata/index。
- 列表接口直接读 summary index。
- 详情接口继续按需读取完整 messages。
- 为旧数据提供懒回填或启动后台回填。
