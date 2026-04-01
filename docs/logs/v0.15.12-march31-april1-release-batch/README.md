# v0.15.12-march31-april1-release-batch

## 迭代完成说明

- 统一收口 2026-03-31 到 2026-04-01 间已进入主线、但尚未完成 npm 发布闭环的公开包漂移，补齐统一 patch batch 发布。
- 本轮发布覆盖了同批次进入仓库的聊天工具卡片、文件预览/diff、终端结果展示与相关 NCP/runtime 联动改动，避免“代码已合并但用户安装不到”的版本漂移继续累积。
- 发布过程中 `changeset publish` 在 `@nextclaw/ncp-react-ui@0.2.11` 遇到本地 npm cache `EEXIST/EACCES` 冲突；处理方式不是清理用户真实缓存，而是改用隔离缓存目录重跑发布，只补齐剩余未发布包。
- 发布后补做了 `nextclaw` 已发布 tarball 与仓库内置前端产物的一致性核对，确认 npm 包实际带上了新的 `packages/nextclaw/ui-dist`；本次同时把该目录同步回仓库，保持仓库状态与已发布安装包一致。
- 本轮关键已发布版本包括：
  - `nextclaw@0.16.31`
  - `@nextclaw/ui@0.11.21`
  - `@nextclaw/server@0.11.22`
  - `@nextclaw/agent-chat-ui@0.2.19`
  - `@nextclaw/ncp-react-ui@0.2.11`
  - 以及联动依赖链：`@nextclaw/channel-plugin-*`、`@nextclaw/channel-runtime`、`@nextclaw/core`、`@nextclaw/mcp`、`@nextclaw/ncp*`、`@nextclaw/nextclaw-engine-*`、`@nextclaw/nextclaw-ncp-runtime-*`、`@nextclaw/openclaw-compat`、`@nextclaw/remote`、`@nextclaw/runtime`

## 测试/验证/验收方式

- 发布与 registry 校验：
  - `PATH=/opt/homebrew/bin:$PATH node scripts/report-release-health.mjs`
  - `PATH=/opt/homebrew/bin:$PATH npm view nextclaw@0.16.31 version`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/ui@0.11.21 version`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/server@0.11.22 version`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/agent-chat-ui@0.2.19 version`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/ncp-react-ui@0.2.11 version`
- 补发执行：
  - `PATH=/opt/homebrew/bin:$PATH npm_config_cache=/tmp/nextclaw-npm-cache pnpm changeset publish`
  - 结果：成功补齐 `@nextclaw/ncp-react-ui@0.2.11`
- 发布产物冒烟：
  - `tmpdir=$(mktemp -d) && cd "$tmpdir" && PATH=/opt/homebrew/bin:$PATH npm pack nextclaw@0.16.31`
  - `tar -tf nextclaw-0.16.31.tgz | rg '^package/ui-dist/(index.html|assets/)'`
  - 结果：确认 tarball 内包含 `ui-dist/index.html` 与完整 `ui-dist/assets/*`
- 仓库同步校验：
  - `PATH=/opt/homebrew/bin:$PATH node -e "const fs=require('fs');const html=fs.readFileSync('packages/nextclaw/ui-dist/index.html','utf8');const refs=[...html.matchAll(/(?:src|href)=\\\"(\\/assets\\/[^\\\"]+)\\\"/g)].map((m)=>m[1].slice(1));const missing=refs.filter((ref)=>!fs.existsSync('packages/nextclaw/ui-dist/'+ref));if(missing.length){console.error(missing.join('\\n'));process.exit(1)}console.log('verified',refs.length)"`
  - 结果：通过，`index.html` 引用与 `assets/` 目录一致

## 发布/部署方式

1. 在仓库根目录新增统一 changeset，覆盖 2026-03-31 到 2026-04-01 的未发布公开包。
2. 执行 `pnpm release:version` 生成版本号与 changelog 变更。
3. 提交 release commit，并基于该提交执行 `pnpm release:publish`。
4. 若发布过程中仅剩个别包因本地缓存冲突失败，则切换到隔离 npm cache 重跑 `pnpm changeset publish`，只补齐未发布版本。
5. 发布完成后，用 `npm view`、`npm pack` 与仓库内 `ui-dist` 核对，必要时把发布时生成的内置前端产物同步回仓库。

## 用户/产品视角的验收步骤

1. 在任意隔离目录执行 `npx --yes nextclaw@0.16.31 --version`，确认输出 `0.16.31`。
2. 安装或升级到 `@nextclaw/ui@0.11.21`、`@nextclaw/server@0.11.22`、`@nextclaw/agent-chat-ui@0.2.19` 后，打开聊天页。
3. 触发一次文件类工具调用，确认运行中可以看到文件预览，完成后可继续查看 diff/内容。
4. 触发一次终端类工具调用，确认展开后显示真实命令输出，而不是结构化 JSON 结果对象。
5. 如需验证 CLI 内置前端资源，解包 `nextclaw@0.16.31` 或直接启动对应版本，确认内置 UI 已带上这轮工具卡片体验更新。
