# 2026-02-20 v0.6.31-release-channel-runtime-0.1.5

## 迭代完成说明（改了什么）

- 发布目标：将 Discord 长文本分片发送修复正式发布到 npm。
- 本次发布产物：
  - `@nextclaw/channel-runtime@0.1.5`
- 关联代码：
  - `packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts`
  - `packages/extensions/nextclaw-channel-runtime/package.json`
  - `packages/extensions/nextclaw-channel-runtime/CHANGELOG.md`

## 测试 / 验证 / 验收方式

### 发布前验证（release:check）

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（仅仓内既有 lint warning，无新增 error）。

### 发布结果核验

```bash
npm view @nextclaw/channel-runtime version
npm view @nextclaw/channel-runtime dist-tags --json
git tag --list '@nextclaw/channel-runtime@0.1.5'
```

验收点：
- `version` 返回 `0.1.5`
- `dist-tags.latest` 为 `0.1.5`
- 本地存在 tag：`@nextclaw/channel-runtime@0.1.5`

### 发布后冒烟（隔离目录）

```bash
TMP_DIR=$(mktemp -d /tmp/nextclaw-channel-runtime-release-smoke.XXXXXX)
cd "$TMP_DIR"
npm init -y
npm install @nextclaw/channel-runtime@0.1.5
node --input-type=module -e "import('@nextclaw/channel-runtime').then((m)=>{console.log('IMPORT_OK', Object.keys(m).slice(0,5).join(','))})"
rm -rf "$TMP_DIR"
```

观察点：
- 输出 `IMPORT_OK ...`，说明 npm 最新包可安装、可导入。

## 发布 / 部署方式

执行流程：

```bash
pnpm release:version
pnpm release:publish
```

本次执行结果：
- 发布成功：`@nextclaw/channel-runtime@0.1.5`
- 自动 tag：`@nextclaw/channel-runtime@0.1.5`

闭环说明：
- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（仅 npm 包发布）。
- 线上 API 冒烟：不适用（无后端 API 发布）。

## 文档影响检查

- `docs/USAGE.md`：不适用（无 CLI 命令/参数变更）。
- Channel Runtime 修复说明已记录于本次 release log 与对应迭代日志。
