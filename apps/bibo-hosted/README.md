# Bibo 已独立开发

应用、client/UI 与官网的唯一源码主仓为 [Peiiii/bibo](https://github.com/Peiiii/bibo)，默认分支 `main`。2026-10-22 完成最后一次冻结导入与独立验证，本目录不再包含可执行应用。

进入 Bibo 仓库按[开发说明](https://github.com/Peiiii/bibo/blob/main/README.zh-CN.md)运行 `pnpm install --frozen-lockfile`、`pnpm dev`；构建、验证与发布入口以[应用说明](https://github.com/Peiiii/bibo/blob/main/apps/bibo-hosted/README.md)为准。

[产品方向](https://github.com/Peiiii/bibo/blob/main/docs/VISION.md) · [原始想法与已确认关系](https://github.com/Peiiii/bibo/blob/main/docs/thoughts/2026-10-21-bibo-open-personal-context-hub.thought.md) · [迁移记录](https://github.com/Peiiii/bibo/blob/main/docs/logs/2026-10-22-bibo-independent-development/README.md)

历史版本可从本仓 Git 历史找回；公共 NextClaw 内核仍在本仓维护，Bibo 通过精确版本的已发布包使用。旧 exporter 已退休，不再生成平行产品副本。
