# v0.17.20-companion-system-feature

## 迭代完成说明

- 本次把 companion 从“临时启动的独立程序”收敛成 NextClaw 的正式系统功能。
- 根因修复点有两层：
  - 配置层新增 `companion.enabled`，并接入现有 config view、runtime update、live reload 与 runtime startup 链路。
  - 运行态层把 companion 进程状态的 owner 放回 companion app 本身，改为由真实 Electron 进程回写共享状态文件，避免用短命 launcher pid 误判 `running=false`。
- companion 现在满足目标语义：
  - 默认关闭
  - 打开后立即启动
  - 关闭后立即停止
  - `enabled=true` 持久化后，下次本地 runtime 可用时自动恢复

## 红区触达与减债记录

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：否
- 说明：
  - 本次为了把 `companion.enabled` 接进现有 runtime config 写入主链路，继续沿用了 `config.ts` 这个历史热点入口。
  - 收尾时已经把 companion 的运行态 owner 收敛到独立的 runtime service / app state file，没有继续把 companion 特殊逻辑堆进 `config.ts`，但这个热点文件本身暂未拆分。
- 下一步拆分缝：
  - 先把 runtime config patch 写入按 `companion / agents / bindings / session` 拆成子模块。
  - 再把 config view 构建与 runtime patch 写入从同一个文件里进一步分离。

## 测试/验证/验收方式

- 已执行：
  - `pnpm -C packages/nextclaw-core test src/config/reload.test.ts`
  - `pnpm -C packages/nextclaw-server test src/ui/config.runtime.test.ts`
  - `pnpm -C apps/companion test`
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C apps/companion tsc`
  - `pnpm -C packages/nextclaw tsc`
- 真实链路冒烟：
  - 使用隔离 `NEXTCLAW_HOME` 启动 `pnpm -C packages/nextclaw dev:build serve --ui-port 18892`
  - 通过 `PUT /api/config/runtime` 切换 `companion.enabled`
  - 观察 `companion status --json` 与共享状态文件，确认热启动、热停止与重启恢复
- 结果：
  - `enabled=false -> true` 会立即启动 companion
  - `enabled=true -> false` 会立即停止 companion，并清理共享状态文件
  - companion 停掉后重新启动 NextClaw runtime，若配置仍为 `enabled=true`，companion 会自动恢复启动

## 发布/部署方式

- 当前不涉及发布或部署。
- 若后续随产品发版，需要同步带上：
  - `@nextclaw/companion`
  - `nextclaw`
  - `@nextclaw/server`
  - `@nextclaw/ui`
  - `@nextclaw/core`

## 用户/产品视角的验收步骤

1. 启动 NextClaw 本地服务。
2. 进入运行时配置页，确认 companion 开关默认关闭。
3. 打开 companion 开关，确认桌面悬浮 companion 立即出现。
4. 再关闭 companion 开关，确认 companion 立即退出。
5. 再次打开 companion 开关，然后完全重启 NextClaw 本地服务。
6. 重启后确认 companion 会自动恢复出现，不需要再次手动打开。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是
- 正向减债动作：职责收敛
- 质量与可维护性提升证明：
  - companion 不再依赖 companion 专属 server API，而是复用现有 runtime config / session / websocket 主链路。
  - companion 的进程真值由真实 Electron 进程回写，不再由外部启动器猜测，运行态 owner 更清晰。
  - `@nextclaw/kernel` 更新合同依赖被收敛到 `@nextclaw/kernel/update-contract` 子路径，减少了 server 对 kernel 根导出的耦合。
- 为何不是单纯压缩行数：
  - 这次不是为了通过行数闸门做格式压缩，而是把 companion 的配置态、运行态和恢复语义收束到现有 owner 上，减少了假状态与双路径。
- 可维护性总结：
  - 这次改动新增了系统功能，但尽量复用了现有 config/runtime 基础设施，没有引入新的 companion 专属后端协议层。
  - 保留债务主要在 `packages/nextclaw-server/src/ui/config.ts` 的历史热点规模上，后续拆分应优先从 runtime patch 写入入口下手。

## NPM 包发布记录

- 本次不涉及 NPM 包发布。
