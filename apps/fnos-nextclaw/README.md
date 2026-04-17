# NextClaw fnOS Package

这个目录维护 NextClaw 的飞牛 fnOS 原生应用打包模板。

## 构建思路

- 运行时复用 `packages/nextclaw` 的 CLI + UI 服务链路
- 打包时通过 `pnpm deploy` 的 `hoisted + copy` 模式导出独立运行目录到 `app/server`
- `cmd/main` 负责使用飞牛提供的 `nodejs_v22` 运行时执行 `nextclaw init` 与 `nextclaw ui`
- `manifest` 使用 `platform` 字段适配飞牛当前文档规范
- `app/ui/config` 提供应用中心入口与图标
- 构建时会生成真实 `64x64 / 256x256` 图标，并同时保留 `icon-*.png` 与 `icon_*.png` 命名
- 构建时会移除 `node_modules/.bin`，确保最终 `app/server` 为零符号链接目录

## 常用命令

```bash
pnpm fnos:package:nextclaw
pnpm fnos:package:nextclaw -- --arch aarch64
```

如果本机已安装 `fnpack`，构建脚本会继续生成 `.fpk`；否则会保留可直接检查的打包目录。
