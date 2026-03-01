# Installer Docker Smoke Test

这个目录用于验证安装器里的 Node 自动安装镜像策略是否可用（`npmmirror` 优先，`nodejs.org` 回退）。

## 运行

```bash
scripts/installer/docker/run-docker-smoke.sh
```

验证 NextClaw 本体启动流程：

```bash
scripts/installer/docker/run-docker-nextclaw-smoke.sh
```

## 覆盖点

- 默认镜像顺序下载
- 镜像回退（首镜像故意不可用）
- 下载后 `node/npm/npx` 可执行
- 本地打包的 `nextclaw` 在容器内可完成 `init -> start -> stop`

## 可选环境变量

- `NODE_VERSION`：默认 `22.20.0`
- `NODE_ARCH`：默认 `x64`
- `NEXTCLAW_NODE_DIST_BASES`：逗号分隔镜像列表
