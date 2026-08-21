# v0.42.1 Service App 宿主运行验证与错误协议

## 迭代完成说明

- 修复目标：内置个人空间在 Windows/Linux Desktop 上调用收藏、日历 Service App 时，不再向 Panel 暴露非 JSON `500`。
- 根因：`node` 宿主别名和已知 runtime 错误归一化虽已进入 `0.42.0`，但发布前只验证了普通 Node 进程，没有以 Electron Node-mode、无系统 Node PATH 执行内置 Service 的真实调用；同时 controller 对未知异常会重新抛给框架，可能生成非 JSON `500`。
- 确认方式：以 Electron executable、`ELECTRON_RUN_AS_NODE=1` 和空 PATH 运行内置个人空间，真实 POST 收藏写/读、日历写/读均成功；新增未知异常路由回归证明响应为 JSON `SERVICE_APP_REQUEST_FAILED` / 500。
- 修复：保留唯一的宿主 Node 解析主链路；新增跨平台 Electron host smoke，并把未知 Service App route 异常收口为结构化 JSON。没有增加 Panel fallback、第二个启动器或系统 Node 扫描。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/server exec vitest run src/features/service-apps/controllers/service-apps.controller.test.ts`：10 个路由合同测试通过。
- `pnpm --filter @nextclaw/server tsc`、定向 ESLint、`pnpm -C apps/desktop tsc`：通过。
- `ELECTRON_RUN_AS_NODE=1 pnpm -C apps/desktop exec electron scripts/smoke/service-app-host.smoke.mjs`：通过；空 PATH 下完成收藏和日历共 4 次 HTTP POST，均返回 JSON 200。
- 推送后由 `desktop-validate` 的 Ubuntu 与 Windows GitHub Actions runner 执行同一 Electron host smoke，作为跨平台发布门。

## 发布/部署方式

- 发布 `nextclaw@0.42.1` 与 `@nextclaw/server` patch，并构建 stable NPM runtime update channel。
- 现有 Desktop launcher 通过 runtime update 获取修复；本次不重发 Desktop installer，除非更新通道验证显示 launcher 不能取得新 runtime。
- 发布后执行 Windows runtime update 检查与 runtime bundle smoke。

## 用户/产品视角的验收步骤

1. 在 Windows 或 Linux Desktop 更新到 stable runtime 后打开个人空间的收藏或日历。
2. 新建一条收藏/日程，再刷新列表。
3. 数据应显示在列表中；失败时界面接收结构化错误，而不是 `Non-JSON response 500`。

## 可维护性总结汇总

- 维持单一 Service App 宿主启动链路，验证脚本只复用 kernel、router 和内置 App 合同。
- smoke 放入现有 `apps/desktop/scripts/smoke/`，没有扩大根级脚本目录。
- maintainability diff check：0 errors、0 warnings；治理检查通过。

## NPM 包发布记录

- 需要发布：是。`nextclaw` 用于向 Desktop runtime update 分发修复；`@nextclaw/server` 覆盖直接消费 server 包的调用方。
- 发布版本：`nextclaw@0.42.1`、`@nextclaw/server@0.17.2`，以及同批依赖的 `@nextclaw/{service,ui,client-sdk,remote,companion}` patch。
- NPM 精确 tarball 验证：7 个包的 registry identity 与已准备 artifact 一致；`nextclaw@0.42.1` 的空缓存 pack/extract payload audit 通过。
- stable runtime：四个平台的签名 bundle、GitHub Release 与 `gh-pages` manifest 已发布；[runtime workflow](https://github.com/Peiiii/nextclaw/actions/runs/32439586770) 通过，Windows `win32-x64` bundle 已包含。
- 发布后更新 smoke：隔离安装的 `0.42.0` 可发现 `0.42.1`，download-only 不切换指针，apply 后新进程报告 `0.42.1`。
- 用户更新说明：[中文](https://docs.nextclaw.io/zh/notes/2026-08-21-nextclaw-v0-42-1) / [English](https://docs.nextclaw.io/en/notes/2026-08-21-nextclaw-v0-42-1)。
