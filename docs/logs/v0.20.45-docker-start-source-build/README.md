# v0.20.45-docker-start-source-build

## 迭代完成说明

- 修复 `pnpm docker:start` 的仓库根目录解析，避免脚本误找 `scripts/docker/compose.yml`。
- 更新 `docker/Dockerfile`：从当前 workspace 源码构建 `nextclaw...` 依赖图，不再维护过期的手写包清单。
- 修正容器启动入口为当前 CLI 路径 `packages/nextclaw/dist/cli/app/index.js`。
- 将 `packages/nextclaw/lib` 加入 `.dockerignore`，避免本地安装产物进入 Docker build context。
- 在 `local-source-runtime-validation` skill 中补充 `pnpm docker:start` 的短命令用途和参数。
- 后续补丁将 Docker 默认 UI/API 改为 `18891` / `18890`，避免占用安装态默认端口 `55667`。
- 后续补丁让 `docker:start` 使用独立 compose project，避免不同 `--container-name` 实例互相 recreate。
- 后续补丁同步 Dockerfile `EXPOSE` 元数据为 `18891`，避免 `docker ps` 继续显示旧默认端口。

## 测试/验证/验收方式

- `bash -n scripts/dev/docker-start.sh`：通过。
- `pnpm docker:start -- --dry-run`：通过，能解析到仓库根的 `docker/compose.yml`。
- `docker compose -f docker/compose.yml config`：通过，build context 指向仓库根。
- `pnpm -r --filter "nextclaw..." list --depth -1`：通过，能解析当前真实构建依赖图。
- 临时目录模拟 Dockerfile copy 集合后执行 `pnpm install --frozen-lockfile --ignore-scripts`：通过。
- 临时目录模拟 Dockerfile copy 集合后执行 `pnpm -r --filter "nextclaw..." build`：通过。
- `pnpm -C packages/nextclaw tsc`：通过。
- `pnpm check:generated-clean`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths scripts/dev/docker-start.sh docker/Dockerfile .dockerignore .agents/skills/local-source-runtime-validation/SKILL.md`：通过。
- `pnpm docker:start -- --ui-port 18891 --api-port 18890 --data-dir /tmp/nextclaw-docker-smoke --container-name nextclaw-docker-smoke`：通过，镜像实际 build 完成，容器启动完成。
- `curl http://127.0.0.1:18891/api/health`：通过，返回 `status=ok`，`ncpAgent=ready`，`cronService=ready`。
- `curl http://127.0.0.1:18891/api/runtime/bootstrap-status`：通过，返回 `phase=ready`，10 个 extension 加载完成。
- `pnpm docker:start -- --dry-run`：通过，默认 UI/API 为 `18891` / `18890`，默认容器和 compose project 为 `nextclaw-docker`。
- `pnpm docker:start`：通过，缓存命中时实际启动约十几秒，默认输出 `http://127.0.0.1:18891`，容器名 `nextclaw-docker`。
- `curl http://127.0.0.1:18891/api/health`：通过，默认短命令启动的容器返回 `status=ok`，`ncpAgent=ready`，`cronService=ready`。

## 发布/部署方式

不涉及线上部署。该改动只影响本地 Docker 验证短命令。

## 用户/产品视角的验收步骤

1. 启动 Docker Desktop 或本机 Docker daemon。
2. 在仓库根目录运行 `pnpm docker:start`。
3. 打开命令输出的 UI 地址，默认是 `http://127.0.0.1:18891`。
4. 需要独立端口或一次性数据目录时运行 `pnpm docker:start -- --ui-port 18891 --api-port 18890 --data-dir /tmp/nextclaw-docker-smoke`。
5. 使用输出的 `docker compose ... logs -f nextclaw` 查看日志，使用输出的 `docker compose ... down` 结束实例。

## 可维护性总结汇总

- 本次是非功能修复，核心运行配置代码净减少：Dockerfile 删除过期手写构建清单，改为复用 pnpm 依赖图。
- 维护性改善来自“删除/复用”：删除旧包名列表，复用 `nextclaw...` 构建合同，降低包重命名后的漂移风险。
- 未引入新抽象；仅把短命令、Dockerfile 和触发 skill 对齐到同一个本地源码验证语义。
- `post-edit-maintainability-review` 适用，复核结论：通过。

## NPM 包发布记录

不涉及 NPM 包发布。
