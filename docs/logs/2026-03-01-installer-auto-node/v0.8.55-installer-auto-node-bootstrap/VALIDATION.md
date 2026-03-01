# 测试 / 验证 / 验收方式

## 构建与静态验证

1. `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
2. `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
3. `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`

结果：
- build: 通过
- lint: 通过（存在历史 `max-lines` warning，无新增 error）
- tsc: 通过

## 安装器冒烟（macOS）

命令：
- `PATH=/opt/homebrew/bin:$PATH node scripts/installer/build-installer.mjs --platform=darwin --arch=arm64 --package-spec=nextclaw@0.8.41 --output-dir=/tmp/nextclaw-installer-test2`

结果：
- 成功生成 `.pkg`
- 产物大小：约 `18.6 MB`
- `pkgbuild` 日志包含 `Adding top-level postinstall script`
- Node 下载镜像顺序已生效：`npmmirror` 优先，`nodejs.org` 回退

## 安装包内容核验（macOS）

- 解包检查 `Scripts/postinstall` 存在且包含 Node 自动安装逻辑。
- 检查 `Payload/Applications/NextClaw/Start NextClaw.command` 与 `Payload/Applications/NextClaw/nextclaw`：
  - 存在 Node 缺失检测
  - 存在自动下载并安装 Node 到用户目录逻辑
  - 下载源为 `npmmirror` 优先，失败自动回退 `nodejs.org`

## Docker 隔离冒烟（Node 自动安装镜像策略）

脚本：
- `scripts/installer/docker/run-docker-smoke.sh`

覆盖：
- 默认镜像顺序（`npmmirror -> nodejs.org`）
- 镜像回退（首镜像故障时自动切换）
- 下载后 `node/npm/npx` 可执行

当前状态：
- 脚本语法检查通过（`bash -n`）
- 容器实际运行通过：
  - case 1 默认镜像顺序：成功从 `npmmirror` 下载并执行 `node/npm/npx`
  - case 2 回退验证：首镜像失败后自动回退到 `npmmirror`，并成功执行 `node/npm/npx`

## Docker 隔离冒烟（NextClaw 本体运行）

流程：
- 自动安装 Node（镜像优先策略）
- 安装本地打包的 `nextclaw` tgz
- 执行 `init -> start --ui-port 19091 -> stop`

结果：
- 通过，容器输出包含：
  - `✓ nextclaw started in background`
  - `UI: http://127.0.0.1:19091`
  - `Stop: nextclaw stop`
