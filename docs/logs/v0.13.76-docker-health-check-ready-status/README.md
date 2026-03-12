# v0.13.76-docker-health-check-ready-status

## 迭代完成说明（改了什么）
- 修复 Docker 官网一键脚本健康检查误判问题：
  - 文件：[apps/landing/public/install-docker.sh](../../../apps/landing/public/install-docker.sh)
  - 原逻辑仅用 `curl --fail` 轮询 `/api/health`，在返回非 2xx 时会误判失败。
  - 新逻辑改为状态码探测：
    - 先探测 `http://127.0.0.1:<ui-port>/api/health`
    - 再探测 `http://127.0.0.1:<ui-port>/`
    - 只要返回 `2xx~4xx` 即视为服务已就绪（容器已启动且端口可访问）。
- 同时去掉轮询阶段噪音报错（不再打印大量 `Recv failure`）。

## 测试/验证/验收方式
- 语法检查：
  - `bash -n apps/landing/public/install-docker.sh`
- 本地脚本真实容器冒烟：
  - `bash apps/landing/public/install-docker.sh --container-name nextclaw-local-smoke-<ts> --data-dir /tmp/nextclaw-local-smoke-<ts> --ui-port 19091 --api-port 19090 --health-timeout 240`
  - 验证点：
    - 脚本退出码为 0，输出 UI/API/Gateway 链接
    - `curl http://127.0.0.1:19091/api/health` 返回 `HTTP 200` 与 `{"ok":true,...}`
    - `curl http://127.0.0.1:19091/` 返回 `HTTP 200`（HTML）
- 官网真实命令冒烟（Docker 专用一键命令）：
  - `curl -fsSL https://nextclaw.io/install-docker.sh | NEXTCLAW_DOCKER_CONTAINER_NAME=nextclaw-official-smoke-<ts> NEXTCLAW_DOCKER_DATA_DIR=/tmp/nextclaw-official-smoke-<ts> NEXTCLAW_DOCKER_UI_PORT=19191 NEXTCLAW_DOCKER_API_PORT=19190 NEXTCLAW_DOCKER_HEALTH_TIMEOUT_SEC=240 bash`
  - 验证点：
    - 脚本打印 `Health check passed`
    - `http://127.0.0.1:19191/api/health` 返回 `HTTP 200`
    - `http://127.0.0.1:19191/` 返回 `HTTP 200`

## 发布/部署方式
- 已执行 landing 发布：
  - `pnpm deploy:landing`
- 发布完成后，官网脚本地址：
  - `https://nextclaw.io/install-docker.sh`

## 用户/产品视角的验收步骤
1. 在安装并启动 Docker 的机器执行：`curl -fsSL https://nextclaw.io/install-docker.sh | bash`
2. 观察终端输出应包含：
   - `Health check passed`
   - `UI: http://127.0.0.1:18791`
   - `API: http://127.0.0.1:18791/api`
3. 打开 UI 地址确认页面可访问。
4. 执行 `docker logs -f nextclaw`，确认服务持续运行。
