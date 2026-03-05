# Iteration v0.0.1-start-service-readiness-timeout

## 1) 迭代完成说明（改了什么）
- 修复 `nextclaw start` 在 Linux/非 Windows 环境下易误判启动失败的问题。
- 根因：后台服务启动健康探测只在首轮等待 `8s`，额外等待仅对 Windows 生效；当渠道初始化较慢（例如 10s+）时，进程仍在启动但被提前判定失败并被杀掉。
- 代码变更：在 `packages/nextclaw/src/cli/commands/service.ts` 中，将“额外等待启动就绪”逻辑从 `win32` 专属改为全平台；并按平台设置扩展等待时长：
  - Windows：额外 20s
  - 其他平台：额外 25s

## 2) 测试/验证/验收方式
- 必跑工程验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟验证（后台服务启动链路）：
  - 在慢启动环境执行 `nextclaw start`
  - 观察不再在 8s 后报 `Failed to start background service`
  - 验证 `http://127.0.0.1:18791/api/health` 返回 `ok: true`

## 3) 发布/部署方式
- 按项目既有发布流程发布 `nextclaw` 新版本（changeset/version/publish）。
- 升级测试机后执行：
  - `nextclaw stop`
  - `nextclaw start`
  - `nextclaw status --json`
- 若本次仅 CLI 包变更，则无需数据库 migration。

## 4) 用户/产品视角的验收步骤
1. 在测试机执行：`nextclaw start`
2. 预期：命令成功返回，不出现 `Failed to start background service`。
3. 执行：`curl http://127.0.0.1:18791/api/health`
4. 预期：返回包含 `"ok":true`。
5. 执行：`nextclaw status --json`
6. 预期：`process.running` 为 `true`，UI/API 地址可用。
