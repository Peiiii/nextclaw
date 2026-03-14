# v0.13.90-docker-install-init-and-process-hardening

## 迭代完成说明（改了什么）
- 优化 Docker 官网一键脚本 [`apps/landing/public/install-docker.sh`](../../../apps/landing/public/install-docker.sh)：
  - 容器内启动链路从 `nextclaw serve` 调整为 `nextclaw init && exec nextclaw serve`，补齐应用初始化并确保前台主进程语义。
  - 默认优先启用 `docker run --init`；若当前 Docker runtime 不支持 `--init`，脚本降级为无 `--init` 启动并打印 warning，而不是直接失败。
  - 启动日志更新为 `npm install + nextclaw init + first start`，让用户明确首启包含初始化步骤。
- 同步更新 Docker 教程文档：
  - [`apps/docs/zh/guide/tutorials/docker-one-click.md`](../../../apps/docs/zh/guide/tutorials/docker-one-click.md)
  - [`apps/docs/en/guide/tutorials/docker-one-click.md`](../../../apps/docs/en/guide/tutorials/docker-one-click.md)
  - 文档新增“脚本实际做了什么 / What The Script Actually Does”，明确 `--init` 与 `init + serve` 的执行原理。

## 测试/验证/验收方式
- 语法与静态检查：
  - `bash -n apps/landing/public/install-docker.sh`
- dry-run 验证：
  - `bash apps/landing/public/install-docker.sh --dry-run`
  - 观察点：命令中包含 `--init`，且容器内命令为 `nextclaw init && exec nextclaw serve`。
- 冒烟验证（本机无 Docker 时，使用隔离 fake-docker 合约冒烟）：
  - 路径 A（runtime 支持 `--init`）：
    - 脚本成功，抓取到 `docker run` 参数包含 `--init`。
    - 抓取到容器命令包含 `nextclaw init && exec nextclaw serve`。
    - 输出包含 `Health check passed` 与 UI URL。
  - 路径 B（runtime 不支持 `--init`）：
    - 脚本打印 warning：`docker runtime does not support '--init'; continuing without init process.`
    - 抓取到 `docker run` 参数不包含 `--init`。
    - 仍可完成 `Health check passed`。
- `build/lint/tsc`：不适用。本次改动仅涉及 shell 脚本与文档，未触达 TS 构建/类型链路。

## 发布/部署方式
- 发布 landing 静态资源以更新线上脚本与文档入口：
  - `pnpm --filter @nextclaw/landing build`
  - `pnpm deploy:landing`
- 发布后用户继续使用同一命令：
  - `curl -fsSL https://nextclaw.io/install-docker.sh | bash`

## 用户/产品视角的验收步骤
1. 在已安装 Docker 的机器执行：`curl -fsSL https://nextclaw.io/install-docker.sh | bash`。
2. 观察终端输出应包含：
   - `Bootstrapping runtime inside container (npm install + nextclaw init + first start)`
   - `Health check passed`
   - `UI: http://127.0.0.1:<ui-port>`
3. 执行 `docker logs -f nextclaw`，确认容器持续运行。
4. 重复执行同一安装命令，确认可幂等重建容器且挂载数据目录保留。
