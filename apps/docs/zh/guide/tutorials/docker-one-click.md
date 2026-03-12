# Docker 一键部署教程

这篇教程面向希望直接在 Docker 中运行 NextClaw 的用户。  
目标：用一条命令跑起来，并拿到可直接访问的 URL。

## 前置条件

- 已安装并启动 Docker（Docker Desktop 或 Docker Engine）。
- 机器可以访问：
  - `https://nextclaw.io`（下载安装脚本）
  - Docker 镜像源（拉取 `node:22-bookworm-slim`）
  - npm registry（安装 `nextclaw`）
- 默认端口未被占用：
  - UI：`18791`
  - Gateway：`18790`

## 一键部署命令

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

## 启动后你会看到什么

脚本完成后会输出类似：

```text
UI: http://127.0.0.1:18791
API: http://127.0.0.1:18791/api
Gateway (direct): http://127.0.0.1:18790
Data dir: /Users/<you>/.nextclaw-docker
Container: nextclaw
```

与 `nextclaw start` 一样，你可以直接打开 UI 链接访问。

## 常用运维命令

查看日志：

```bash
docker logs -f nextclaw
```

重启：

```bash
docker restart nextclaw
```

停止：

```bash
docker stop nextclaw
```

删除容器（数据目录保留）：

```bash
docker rm -f nextclaw
```

## 自定义端口 / 数据目录 / 容器名

### 方式 1：环境变量（最常用）

```bash
NEXTCLAW_DOCKER_UI_PORT=18891 \
NEXTCLAW_DOCKER_API_PORT=18890 \
NEXTCLAW_DOCKER_CONTAINER_NAME=nextclaw-prod \
NEXTCLAW_DOCKER_DATA_DIR="$HOME/.nextclaw-docker-prod" \
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

### 方式 2：脚本参数

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash -s -- \
  --ui-port 18891 \
  --api-port 18890 \
  --container-name nextclaw-prod \
  --data-dir "$HOME/.nextclaw-docker-prod"
```

### 仅预览命令（不实际启动）

```bash
curl -fsSL https://nextclaw.io/install-docker.sh | bash -s -- --dry-run
```

## 升级到最新版本

直接重复执行一键命令即可。  
脚本会重建同名容器，数据仍在挂载目录中（默认 `~/.nextclaw-docker`）。

如果你想固定版本，可指定：

```bash
NEXTCLAW_DOCKER_INSTALL_TARGET=nextclaw@0.13.0 \
curl -fsSL https://nextclaw.io/install-docker.sh | bash
```

## 常见问题

### 报错：`docker is required`

说明系统找不到 Docker。请先安装 Docker 并确认 `docker version` 可用。

### 报错：`docker daemon is not reachable`

说明 Docker 服务未启动。请先启动 Docker Desktop/daemon。

### 报错：健康检查超时（`/api/health`）

先看容器日志：

```bash
docker logs --tail 120 nextclaw
```

常见原因：

- 拉取镜像/安装 npm 包较慢（网络问题）
- 端口冲突导致服务没起来

### 端口冲突

改用其他端口重新执行，见“自定义端口”示例。

## 相关文档

- [上手](/zh/guide/getting-started)
- [配置](/zh/guide/configuration)
- [故障排查](/zh/guide/troubleshooting)
