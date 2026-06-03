# v0.20.21 Source Runtime Local Validation

## 迭代完成说明

本次新增了“源码构建实例本地验证”机制，用于验证当前仓库构建产物的真实 start / restart / stop 行为，避免误用 PATH 中全局安装的旧 `nextclaw`。

交付内容：

- 新增 `pnpm local:source-runtime`；
- 新增 `scripts/local/source-runtime-instance.mjs`；
- 新增 `local-source-runtime-validation` project skill；
- 新增设计文档 `docs/designs/2026-06-03-source-runtime-local-validation-harness-design.md`。

默认策略已调整为 `shared-data`：真实数据使用 `~/.nextclaw`，运行态文件写入 `~/.nextclaw-source-runtime/<instance>/run`，避免测试实例误控制真实主实例。

## 测试/验证/验收方式

已执行：

```bash
pnpm local:source-runtime -- --help
pnpm local:source-runtime -- start --port 18991 --home-mode temp --no-build --dry-run
pnpm local:source-runtime -- status --port 18991 --home-dir /tmp/nonexistent-nextclaw-source-runtime --json
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"
pnpm exec eslint scripts/local/source-runtime-instance.mjs
pnpm local:source-runtime -- start --port 18993 --home-mode temp --no-build --dry-run
pnpm local:source-runtime -- start --port 18994 --home-mode clone-config --instance lint-smoke-2 --no-build --dry-run
pnpm local:source-runtime -- start --port 18888 --no-build --dry-run
pnpm local:runtime -- --no-build --dry-run
pnpm local:runtime:restart -- --dry-run
pnpm local:runtime:stop -- --dry-run
pnpm local:runtime:status -- --json
pnpm -C packages/nextclaw-core test -- src/shared/lib/core-utils/utils/runtime-paths.utils.test.ts
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw tsc
pnpm exec eslint scripts/local/source-runtime-instance.mjs packages/nextclaw-core/src/shared/lib/core-utils/index.ts packages/nextclaw-core/src/shared/lib/core-utils/utils/runtime-paths.utils.ts packages/nextclaw-core/src/shared/lib/core-utils/utils/runtime-paths.utils.test.ts packages/nextclaw-service/src/shared/stores/managed-service-state.store.ts packages/nextclaw-service/src/shared/stores/local-ui-runtime.store.ts packages/nextclaw-service/src/shared/stores/companion-runtime.store.ts packages/nextclaw-service/src/shared/utils/restart/restart-sentinel.utils.ts packages/nextclaw-service/src/shared/services/runtime/utils/service-remote-runtime.utils.ts packages/nextclaw-service/src/shared/utils/cli.utils.ts
pnpm check:generated-clean
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/local/source-runtime-instance.mjs .agents/skills/local-source-runtime-validation/SKILL.md docs/designs/2026-06-03-source-runtime-local-validation-harness-design.md package.json
pnpm check:governance-backlog-ratchet
pnpm lint:new-code:governance
```

真实 build + start smoke 已尝试：

```bash
pnpm local:source-runtime -- start --port 18992 --home-mode temp --start-timeout 45000
```

该路径被当前工作区 UI build 阻塞：`@nextclaw/ui` 构建时报错 `"describeCronDelivery" is not exported by "src/shared/lib/cron/index.ts"`。这是当前 changed set 中 cron 相关 WIP 的构建问题，不属于本次 harness 机制。

`pnpm lint:new-code:governance` 已通过；module-structure 阶段仍提示 touched legacy warning，涉及 service legacy shared stores / cron WIP，但不阻塞。

## 发布/部署方式

不涉及线上部署。

本机制是本地开发/验证入口，后续随仓库源码一起发布；没有单独 runtime migration。

## 用户/产品视角的验收步骤

推荐用户执行：

```bash
pnpm local:source-runtime -- start --port 18888
```

更短的一键入口：

```bash
pnpm local:runtime
```

默认行为：

```text
NEXTCLAW_HOME=~/.nextclaw
NEXTCLAW_RUN_HOME=~/.nextclaw-source-runtime/default/run
```

启动成功后打开：

```text
http://127.0.0.1:18888
```

验证 restart：

```bash
pnpm local:runtime:restart
```

验证状态：

```bash
pnpm local:runtime:status
```

收尾：

```bash
pnpm local:runtime:stop
```

若需要完全临时隔离：

```bash
pnpm local:source-runtime -- start --home-mode temp --port 18889
```

## 可维护性总结汇总

本次是新增本地验证能力，非测试生产脚本净增为预期新增。

维护性措施：

- 把流程集中到单一脚本 owner，避免散落在文档中的临时命令；
- 通过 project skill 固化 AI 触发方式，避免未来继续误跑全局 `nextclaw`；
- 默认 `shared-data`，把真实用户数据复用和运行态隔离解耦；
- `--dry-run` 不写配置、不创建 temp home；
- 设计文档沉淀 dev / build / Docker 的边界。

maintainability guard 对新增脚本无错误、无警告。

追加 shared-data run path 后，maintainability guard 无错误；有 1 个既有预算 warning：`packages/nextclaw-service/src/shared/utils/cli.utils.ts` 当前 344 行，接近 400 行预算。

## NPM 包发布记录

不涉及 NPM 包发布。
