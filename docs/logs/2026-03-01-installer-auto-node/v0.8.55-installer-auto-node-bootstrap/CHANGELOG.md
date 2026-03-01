# v0.8.55 Installer Auto Node Bootstrap

## 迭代完成说明（改了什么）

- 改造安装器构建脚本 `scripts/installer/build-installer.mjs`：
  - 安装包不再携带完整 Node runtime 到最终安装目录，改为更轻量分发。
  - 构建阶段仍下载 Node runtime，仅用于离线/稳定执行 `npm install` 打包应用 payload。
  - macOS 安装包新增 `postinstall`，在系统缺少 `node/npm/npx` 时自动尝试安装 Node.js。
  - 启动脚本（macOS `.command` / Windows `.cmd`）新增 Node 自动引导：系统无 Node 时自动下载并安装到用户目录后继续启动。
  - Node 下载源改为“国内优先镜像 + 官方回退”：默认按 `npmmirror -> nodejs.org` 依次尝试。
  - 支持通过环境变量 `NEXTCLAW_NODE_DIST_BASES` 覆盖 Node 下载源顺序（逗号分隔）。
- 更新 Windows NSIS 模板 `scripts/installer/windows-installer.nsi`：
  - 安装阶段增加 Node 自动检查与安装（失败不阻断安装，首次启动会再次尝试）。
  - 安装阶段 Node 下载同样改为“国内优先镜像 + 官方回退”。
- 新增 Docker 冒烟测试资产（用于隔离验证 Node 自动安装镜像策略）：
  - `scripts/installer/docker/Dockerfile`
  - `scripts/installer/docker/smoke-node-bootstrap.sh`
  - `scripts/installer/docker/run-docker-smoke.sh`
  - `scripts/installer/docker/README.md`

## 设计结论

- 目标：用户直接运行安装器即可使用，且安装包尽量轻量。
- 方案：安装器和首次启动双重兜底自动安装 Node，避免用户手动安装门槛。
