# 2026-04-15 fnOS NextClaw Package Design

## 背景

目标是在不引入第二套运行时架构的前提下，把现有 `packages/nextclaw` CLI + UI 服务链路封装成飞牛 fnOS 原生应用，满足应用中心上架需要。

## 方案

- 采用 fnOS Native 应用形态，而不是 Electron 或 Docker 包
- 运行时依赖声明为 `nodejs_v22`
- 使用 `pnpm deploy --filter nextclaw --prod` 导出一份可独立运行的 NextClaw 生产目录到 `app/server`
- 使用 `cmd/main` 按飞牛约定管理进程生命周期
- 使用 `app/ui/config` 暴露应用中心入口，指向 NextClaw 服务端口
- 将 fnOS 固定配置拆到 `apps/fnos-nextclaw/pack-template`，最终产物输出到 `dist/fnos-nextclaw/<arch>/fnnas.nextclaw`

## 关键取舍

- 不新造一套 NAS 专属服务实现，避免长期双轨维护
- 不把 `node` 二进制打进包里，改为依赖飞牛官方 `nodejs_v22`
- 不默认申请 data share 和授权目录，先把状态与配置收敛到 `TRIM_PKGVAR`
- 先支持 `x86_64` 与 `aarch64` manifest 生成，真正 `.fpk` 生成取决于本机是否安装 `fnpack`

## 验证

- 本地执行打包脚本，确认能生成完整 `fnnas.nextclaw` 目录
- 冒烟执行生成目录内的 `cmd/main start/status/stop`
- 若本机存在 `fnpack`，额外验证 `.fpk` 产物生成
