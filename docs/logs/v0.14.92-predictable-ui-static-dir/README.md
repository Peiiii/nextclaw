# v0.14.92-predictable-ui-static-dir

## 迭代完成说明

- 删除 `nextclaw` UI 静态资源解析中的隐式兜底，不再从 `cwd`、源码仓库邻近目录或 repo frontend dist 借用前端产物
- 将运行契约收敛为两条明确路径：显式 `NEXTCLAW_UI_STATIC_DIR`，或 npm 包内自带的 `packages/nextclaw/ui-dist`
- 当 `NEXTCLAW_UI_STATIC_DIR` 指向无效目录时直接失败，不再静默回退，避免“发布包有问题但本机碰巧能跑”的假象
- 补充回归测试，覆盖显式 override、生效失败、bundled `ui-dist` 命中，以及禁止借用 `cwd` repo dist

## 测试/验证/验收方式

- 代码级验证：
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw build`
  - `pnpm -C packages/nextclaw test -- src/cli/utils.ui-static-dir.test.ts`
- 发布前冒烟：
  - 在隔离目录安装本地 tarball，启动 `nextclaw`
  - 验证 `/` 返回前端 HTML，且服务状态中的 `uiStaticDir` 来自安装包内 `ui-dist`
  - 将 `NEXTCLAW_UI_STATIC_DIR` 指向无效目录后再次启动，验证进程直接失败而不是静默兜底
- 发布后验收：
  - 在干净目录安装发布后的 `nextclaw@0.13.15`
  - 验证 `/` 与 `/api/health` 正常响应，再执行 `nextclaw stop`

## 发布/部署方式

- 为 `nextclaw` 生成 patch release，目标版本 `0.13.15`
- 按项目 release group 约束，同步带出 `@nextclaw/mcp` 与 `@nextclaw/server` 的 companion patch version，避免绕过既有发布机制
- 使用项目既有 release 版本化流程生成版本号与 changelog
- 发布到 npm 后，在隔离环境重新安装并完成启动冒烟验证
- 本次仅涉及 npm 包发布，不涉及远程 migration 或服务端部署

## 用户/产品视角的验收步骤

1. 全局安装或在隔离目录安装 `nextclaw@0.13.15`
2. 执行 `nextclaw start`
3. 打开首页，确认不再出现前端 `404 not found`
4. 执行 `nextclaw status`，确认 UI 静态目录指向安装包自带资源，而不是本地源码目录
5. 将 `NEXTCLAW_UI_STATIC_DIR` 临时设置为不存在或缺少 `index.html` 的目录后再次启动，确认命令直接报错并给出明确恢复提示
