---
name: nextclaw-marketplace-skill-integration
description: 当评估、适配、创建或发布 NextClaw 用户可用的 marketplace skill 时使用；统一处理产品集成与远端发布，但先选择一个阶段并只读取对应 reference。
---

# Marketplace Skill 生命周期

## 入口判断

- 判断某能力是否应成为用户可安装 skill、如何封装外部工具/runtime、产品边界和信任体验：读取 [集成设计](references/integration-design.md)。
- 已有本地 skill，需要补 marketplace 元数据、发布、远端校验或安装冒烟：读取 [发布流程](references/publishing.md)。

不要同时读取两个阶段；只有集成产物已经完成并进入发布时才切换。

## 共同边界

- 区分产品 marketplace skill 与仓库 `.agents/skills` 治理 skill。
- 优先复用现有 runtime、tool、plugin 和安装协议，不在 skill 中重造基础设施。
- 用户可见名称、描述、权限、依赖和失败边界必须明确。
- 发布前运行 `scripts/validate-marketplace-skill.py`；发布后必须验证本地、官方源和默认国内读源的文件路径与 SHA-256 完全一致，并通过默认源安装/更新路径。

输出当前阶段、证据、缺口和下一步；不要把设计讨论与发布命令混成一次全量加载。
