# 2026-02-19 v0.6.22-openclaw-registry-final-align

## 迭代完成说明

- 目标：继续推进“最终形态对齐”，把 NextClaw 兼容层从 loader 内联注册，收敛为 OpenClaw 同款 `registry` 职责分层。
- 本次核心改动：
  - 新增注册内核：`packages/nextclaw-openclaw-compat/src/plugins/registry.ts`
    - 统一处理 `registerTool/registerChannel/registerProvider`。
    - 统一处理保留名校验、去重冲突、插件诊断。
    - 统一创建 `OpenClawPluginApi`，并封装不支持能力的 warning 行为。
  - `loader.ts` 对齐为“发现/校验/装载”职责：
    - bundled 渠道与外部插件都通过同一 `registerPluginWithApi(...)` 注册路径。
    - 去掉 loader 内大段重复内联注册逻辑，结构更接近 OpenClaw 的 `loader + registry` 分工。
  - 导出更新：
    - `packages/nextclaw-openclaw-compat/src/index.ts` 新增导出 `plugins/registry.js`。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（仅既有 warning，无新增 error）。

### 冒烟验证（隔离目录）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-final-align-smoke.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- 插件渠道绑定仍完整（9 个 `builtin-channel-*`）。
- 关闭外部插件发现后（`NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0`）bundled 渠道仍可注册并可见。

## 发布 / 部署方式

本次变更只影响 `@nextclaw/openclaw-compat` 的插件注册实现，不涉及后端或数据库。

### 执行流程（按 `docs/workflows/npm-release-process.md`）

```bash
pnpm release:version
pnpm release:publish
```

发布结果：
- `@nextclaw/openclaw-compat@0.1.7` ✅
- tag：`@nextclaw/openclaw-compat@0.1.7` ✅

### 闭环说明（按需项）

- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（本次为 npm 包发布）。
- 线上 API 冒烟：不适用（无线上后端 API 发布）。
- CLI 冒烟：已执行并记录。
