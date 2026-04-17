# v0.16.26-fnos-nextclaw-package

## 迭代完成说明

本次新增了 NextClaw 的飞牛 fnOS 原生应用打包链路，目标是把现有 `packages/nextclaw` CLI + UI 服务路径封装成可上架到飞牛应用中心的 Native 包目录。

- 新增 `apps/fnos-nextclaw/pack-template`，落地了飞牛包所需的核心文件：
  - `manifest`
  - `ICON.PNG`
  - `ICON_256.PNG`
  - `config/privilege`
  - `config/resource`
  - `cmd/main`
  - `cmd/install_init`
  - `cmd/install_callback`
  - `cmd/uninstall_init`
  - `cmd/uninstall_callback`
  - `cmd/upgrade_init`
  - `cmd/upgrade_callback`
  - `cmd/config_init`
  - `cmd/config_callback`
  - `app/ui/config`
- 新增 `scripts/fnos/build-nextclaw-package.mjs`：
  - 通过 `pnpm -r --filter nextclaw... build` 构建当前仓库内的 NextClaw 运行产物
  - 通过 `pnpm deploy` 的 `hoisted + copy` 模式导出可独立运行的生产目录到 `app/server`
  - 自动注入版本号、平台和服务端口
  - 自动生成真实 `64x64 / 256x256` 图标，并拷贝 `fnpack` 要求的顶层图标
  - 若本机存在 `fnpack`，继续构建 `.fpk`，并把产物归位到 `dist/fnos-nextclaw/<arch>/`
- 安装阶段出现“设置目录权限失败”后，已把 `config/resource` 收敛为最小空对象，移除非必需的 `data-share` 声明，避免安装时再触发共享目录授权流程
- 已移除非必需的 `username/groupname` 自定义声明，回到飞牛推荐的最小 `run-as=package` 配置，降低安装阶段用户/组创建与授权耦合风险
- 已把 `manifest` 从过时的 `arch` 切换为官方当前文档推荐的 `platform`
- 已把 `app/server` 改成零符号链接产物：
  - 不再使用含大量 symlink 的默认 `pnpm deploy` 结果直接入包
  - 改为 `node-linker=hoisted + package-import-method=copy`
  - 额外删除运行时不需要的 `.bin` 目录，确保 `find app/server -type l` 结果为 `0`
- 已把 `cmd/main` 改为 fail-fast：
  - 找不到 `node` 或 CLI 入口时直接返回失败
  - `init` 失败时直接返回失败
  - `ui` 进程启动后 2 秒内退出会直接返回失败
- 根脚本新增 `pnpm fnos:package:nextclaw`
- 新增设计文档：
  - [fnOS NextClaw Package Design](../../plans/2026-04-15-fnos-nextclaw-package-design.md)

这次选择的是“复用现有 NextClaw 服务链路 + 飞牛原生包壳”的路线，而不是再造一套 NAS 专属服务实现或硬套 Electron。

最终已在本机产出可交付安装包：

- `dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk`
- SHA-256:
  - `fbc1c081f81cdf5e142b791490704cfc4d858dc7a2b5d73834e8eb5d6805ce3f`

## 测试 / 验证 / 验收方式

已执行：

```bash
PATH="/tmp/fnpack-bin:$PATH" pnpm fnos:package:nextclaw -- --arch x86_64 --service-port 19124
TRIM_PKGVAR=/tmp/fnos-nextclaw-runtime-19124/pkgvar \
TRIM_APPDEST=/Users/peiwang/Projects/nextbot/dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app \
PATH="$(dirname $(which node)):$PATH" \
bash dist/fnos-nextclaw/x86_64/fnnas.nextclaw/cmd/main start

TRIM_PKGVAR=/tmp/fnos-nextclaw-runtime-19124/pkgvar \
TRIM_APPDEST=/Users/peiwang/Projects/nextbot/dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app \
PATH="$(dirname $(which node)):$PATH" \
bash dist/fnos-nextclaw/x86_64/fnnas.nextclaw/cmd/main status

curl -I --max-time 10 http://127.0.0.1:19124

TRIM_PKGVAR=/tmp/fnos-nextclaw-runtime-19124/pkgvar \
TRIM_APPDEST=/Users/peiwang/Projects/nextbot/dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app \
PATH="$(dirname $(which node)):$PATH" \
bash dist/fnos-nextclaw/x86_64/fnnas.nextclaw/cmd/main stop
```

结果：

- `PATH="/tmp/fnpack-bin:$PATH" pnpm fnos:package:nextclaw -- --arch x86_64 --service-port 19124` 通过，同时生成：
  - `dist/fnos-nextclaw/x86_64/fnnas.nextclaw`
  - `dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk`
- `cmd/main start` 后 `status` 返回退出码 `0`
- `curl -I http://127.0.0.1:19124` 在第 2 次探测返回 `HTTP/1.1 200 OK`
- `cmd/main stop` 后 `status` 返回退出码 `3`
- 日志确认首次启动路径为：
  - 自动执行 `nextclaw init`
  - 然后执行 `nextclaw ui --port 19124`
  - 在未配置 provider 时仍能成功拉起 UI，只提示“agent replies are disabled”
- `shasum -a 256 dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk` 输出：
  - `fbc1c081f81cdf5e142b791490704cfc4d858dc7a2b5d73834e8eb5d6805ce3f`
- 针对用户反馈的“设置目录权限失败”，已重打一版不含 `data-share` 的安装包
- 静态核验通过：
  - `manifest` 中实际写入 `platform=x86`
  - 顶层 `LICENSE` 已打入产物
  - `app/ui/images/icon-64.png` 与 `ICON.PNG` 为真实 `64x64`
  - `app/ui/images/icon-256.png` 与 `ICON_256.PNG` 为真实 `256x256`
  - `find dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app/server -type l | wc -l` 输出 `0`
  - `find dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app/server -type d -name '.bin' | wc -l` 输出 `0`
- 失败场景模拟通过：
  - 当 `TRIM_APPDEST` 指向不存在目录时，`cmd/main start` 返回退出码 `1`
  - 日志明确记录 `missing cli entry`

额外验证：

- `node dist/fnos-nextclaw/x86_64/fnnas.nextclaw/app/server/dist/cli/index.js --help` 通过
- `fnpack` 官方下载源验证通过：
  - `https://static2.fnnas.com/fnpack/fnpack-1.2.1-darwin-arm64`
  - `https://static2.fnnas.com/fnpack/fnpack-1.2.1-linux-amd64`
- `pnpm lint:maintainability:guard` 未能全绿收尾，但阻塞项来自工作区内与本次无关的既有脏改动：
  - `packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts`
  - 该文件本次因既有变更跨过 file budget 阈值，不属于本次飞牛包改动范围

## 发布 / 部署方式

当前脚本已支持在本机装好官方 `fnpack` 后直接生成最终 `.fpk` 文件。

在具备官方 `fnpack` 的机器上，发布方式为：

```bash
pnpm fnos:package:nextclaw -- --arch x86_64
# 或
pnpm fnos:package:nextclaw -- --arch aarch64
```

若脚本检测到 `fnpack`，会自动继续执行：

```bash
fnpack build -d dist/fnos-nextclaw/<arch>/fnnas.nextclaw
```

随后脚本会把 `fnpack` 产物归位到：

- `dist/fnos-nextclaw/<arch>/fnnas.nextclaw.fpk`

本次已确认的 `x86_64` 实际产物：

- `dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk`

## 用户 / 产品视角的验收步骤

1. 在仓库根目录执行 `pnpm fnos:package:nextclaw -- --arch x86_64`，确认产出：
   - `dist/fnos-nextclaw/x86_64/fnnas.nextclaw`
   - `dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk`
2. 打开产物目录，确认包含飞牛要求的目录结构：
   - `manifest`
   - `ICON.PNG`
   - `ICON_256.PNG`
   - `cmd/main`
   - `cmd/install_init`
   - `cmd/install_callback`
   - `cmd/uninstall_init`
   - `cmd/uninstall_callback`
   - `cmd/upgrade_init`
   - `cmd/upgrade_callback`
   - `cmd/config_init`
   - `cmd/config_callback`
   - `config/privilege`
   - `config/resource`
   - `app/server`
   - `app/ui/config`
   - `app/ui/images/icon_64.png`
   - `app/ui/images/icon_256.png`
3. 读取 `manifest`，确认：
  - `install_dep_apps=nodejs_v22`
  - `desktop_applaunchname=fnnas.nextclaw.Application`
  - `platform=x86`
  - `service_port` 与 `app/ui/config` 中端口一致
4. 用本节验证命令执行一次 `start -> status -> curl -> stop`，确认应用中心入口实际指向的服务能启动
5. 校验最终安装包摘要：
   - `shasum -a 256 dist/fnos-nextclaw/x86_64/fnnas.nextclaw.fpk`
   - 预期为 `fbc1c081f81cdf5e142b791490704cfc4d858dc7a2b5d73834e8eb5d6805ce3f`
6. 将生成的 `.fpk` 提交到飞牛开放平台进行上架

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次没有另造一套 NAS 专属服务，而是把已有 `nextclaw` 运行时收敛成一层飞牛打包壳，沿着“复用现有能力、减少双轨实现、让统一入口覆盖更多宿主环境”的方向推进了一步。

### 可维护性复核结论

通过。

- `fnOS` 相关职责被集中在 `apps/fnos-nextclaw` 和 `scripts/fnos/build-nextclaw-package.mjs`
- 没有把飞牛特化逻辑渗回 `packages/nextclaw` 主运行时代码
- `cmd/main` 已收敛为单一启动路径：`init + ui`
- no maintainability findings

### 本次顺手减债

是。

- 没有引入第二套 NextClaw 服务实现
- 删除了构建脚本里的重复 `nextclaw-ui` 单独构建步骤，改为复用递归构建
- 把飞牛包模板与生成产物分离，避免把最终打包目录直接固化到源码树里

### 代码增减报告

- 新增：414 行
- 删除：0 行
- 净增：+414 行

### 非测试代码增减报告

- 新增：414 行
- 删除：0 行
- 净增：+414 行

说明：

- 本次无测试文件改动，因此“代码增减报告”和“非测试代码增减报告”一致
- 以上统计只覆盖本次新增的执行脚本、打包模板与 `package.json` 脚本入口
- 另有文档净增 `218` 行，来自设计文档与本迭代记录

### 删减优先 / 简化优先判断

是。

- 选择复用 `packages/nextclaw` 现有运行链路，而不是复制一份 NAS 版 server
- 通过 `pnpm deploy` 导出生产目录，避免手写一长串容易漂移的复制清单
- 通过 `TRIM_PKGVAR` 承接状态与配置，避免新增 data-share / 授权目录等不必要复杂度
- 生命周期占位脚本采用最小空实现，避免为当前不需要的安装/升级流程叠加额外逻辑
- privilege 与 resource 都已收敛为最小必要配置，尽量减少安装期副作用
- 通过零符号链接产物进一步降低安装期文件系统兼容风险

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

有净增长，但属于最小必要。

- 新增文件数是必要的，因为飞牛原生包天然就要求 `manifest/cmd/config/ui` 这套显式骨架
- 目录平铺度没有明显恶化：
  - 新复杂度集中在 `apps/fnos-nextclaw`
  - 构建逻辑集中在 `scripts/fnos`
- 没有把飞牛逻辑散落到多个既有功能目录

### 抽象 / 模块边界 / class / helper / service / store 等职责划分判断

更清晰。

- 打包模板职责在 `apps/fnos-nextclaw/pack-template`
- 组装与导出职责在 `scripts/fnos/build-nextclaw-package.mjs`
- 真正运行时仍然由 `packages/nextclaw` 自身负责

本次避免了：

- 为 NAS 再加一层自定义 service
- 在 `packages/nextclaw` 中混入飞牛平台特有分支
- 用多个零散 shell helper 拼接打包流程

### 目录结构与文件组织判断

满足当前项目治理要求。

- 新目录名和新文件名均符合 kebab-case / 低歧义规则
- 业务实现、打包模板和设计文档分层清楚
- 生成产物固定输出到 `dist/fnos-nextclaw/<arch>/fnnas.nextclaw`

### 额外说明

`pnpm lint:maintainability:guard` 的最终失败并非本次飞牛包代码引入，而是工作区里一份与本次无关的既有脏改动命中 file budget 治理规则；本次新增文件未发现新的治理违规。
