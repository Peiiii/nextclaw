# v0.14.89 Remote Managed Service Runtime Fix

## 迭代完成说明

- 修复了 Remote Access 托管模式下的一个根因缺陷：
  - 当磁盘配置里的 `ui.enabled=false`，但用户通过 `nextclaw start --ui-port ...` 或 `serve` 的运行时 UI 覆盖启动服务时，remote connector 之前不会被创建，导致远程诊断长期停在 `service-runtime: disconnected`
- 现在 remote connector 的创建条件改为判断“生效后的 UI 运行状态”，而不是判断原始配置文件里的 `config.ui.enabled`
- 新增回归测试，覆盖：
  - 原始 `config.ui.enabled=false` 但生效 UI 已开启时，必须创建 remote module
  - 生效 UI 未开启时，不应创建 remote module
- 在本机全局安装中替换为修复版，并完成真实重启验证

## 测试/验证/验收方式

- 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/service-remote-runtime.test.ts src/cli/commands/remote-access-host.test.ts`
- 构建与类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- 真实运行验证：
  - `PATH=/opt/homebrew/bin:$PATH nextclaw stop`
  - `PATH=/opt/homebrew/bin:$PATH nextclaw start --ui-port 18888`
  - `PATH=/opt/homebrew/bin:$PATH nextclaw remote status`
  - `PATH=/opt/homebrew/bin:$PATH nextclaw remote doctor`
- 实际结果：
  - 修复前：`service-runtime: disconnected`
  - 修复后：`service-runtime: connected`
  - `service.json` 中已写入 `deviceId`、`lastConnectedAt`、`state=connected`

## 发布/部署方式

- 本次未执行 npm / docs / 后端发布
- 本次为本地缺陷修复与本机安装替换验证：
  - 构建本地 `packages/nextclaw`
  - 校验全局安装的 `dist/cli/index.js` 与本地构建产物 hash 一致
  - 重启本机托管服务完成实机验收

## 用户/产品视角的验收步骤

1. 确保已经在 Remote Access 页面登录平台账号，并启用远程访问
2. 使用带端口的后台启动，例如：`nextclaw start --ui-port 18888`
3. 打开 `设置 -> 远程访问`
4. 查看状态概览与诊断
5. 预期结果：
   - 设备显示正常
   - 连接器状态不再停留在长期 `已断开`
   - `remote doctor` 中 `service-runtime` 通过
   - 可看到已注册的 `deviceId`
