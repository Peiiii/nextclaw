# v0.15.43-start-service-cli-entry-fix

## 迭代完成说明

- 修复 `nextclaw start/restart` 的后台服务启动根因：`spawnManagedService` 不再直接拼 `node serve --ui-port ...`，改为统一复用 CLI entry 解析器，通过真实 CLI 入口启动 `serve` 子命令。
- 为后台托管启动补充回归测试，锁定“必须经由 CLI entry 启动后台服务”的契约，覆盖打包 JS 入口场景。
- 同步收紧 `AGENTS.md` 中的根因修复规则，明确禁止对用户提供临时绕过、fallback 或补丁式建议作为默认答案。

## 测试/验证/验收方式

- 单测：`pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/runtime/tests/service-managed-startup.test.ts`
- Lint：`pnpm -C packages/nextclaw lint`
- 类型检查：`pnpm -C packages/nextclaw tsc`
- 构建：`pnpm -C packages/nextclaw build`
- 维护性守卫：`pnpm lint:maintainability:guard`
- 冒烟：

```bash
NEXTCLAW_HOME="$(mktemp -d)/home" node packages/nextclaw/dist/cli/index.js start --ui-port 18831 --start-timeout 20000
node -e 'const url = process.argv[1]; fetch(url).then(async (res) => { const body = await res.json(); if (!res.ok || body?.ok !== true || body?.data?.status !== "ok") process.exit(1); console.log(JSON.stringify(body)); })' "http://127.0.0.1:18831/api/health"
NEXTCLAW_HOME="$NEXTCLAW_HOME" node packages/nextclaw/dist/cli/index.js stop
```

- 冒烟结果：后台服务成功拉起，`/api/health` 返回 `{"ok":true,"data":{"status":"ok"}}`，随后正常停止。

## 发布/部署方式

- 不适用。本次未执行 npm 发布、远程部署或 migration。
- 若后续发布 `nextclaw` 包，需按既有发布流程完成 `release:check`、version、publish，并确保本修复包含在发布产物中。

## 用户/产品视角的验收步骤

1. 在已安装或本地构建的 `nextclaw` CLI 环境中执行 `nextclaw restart`。
2. 确认不再出现 `Cannot find module '.../serve'` 或 `node serve --ui-port ...` 这类错误。
3. 确认命令输出 `nextclaw started in background`。
4. 访问 `http://127.0.0.1:<port>/api/health`，确认返回健康状态。
5. 执行 `nextclaw stop`，确认服务可以正常停止。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。修复直接落在启动命令构造源头，没有新增 fallback、兼容分支或事故特判。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。核心改动是复用已有 CLI entry 解析器，删除错误的手拼 `serve` 启动路径，而不是再包一层特殊判断。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本满足。非测试代码净增 20 行，原因是把启动命令构造收敛到已存在的解析器时，顺手完成了一次参数解构治理；该净增属于最小必要。测试新增 85 行，用于锁住回归面，避免同类发布事故再次进入产物。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。后台托管启动继续保持单一入口 `spawnManagedService`，CLI entry 解析职责复用既有 `resolveCliSubcommandLaunch`，没有新增新的 helper 层或临时适配层。
- 目录结构与文件组织是否满足当前项目治理要求：是。仅新增一个同目录测试文件，没有扩散目录平铺，也没有引入新的职责混放。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。独立复核结论如下：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：129 行
    - 删除：24 行
    - 净增：105 行
  - 非测试代码增减报告：
    - 新增：44 行
    - 删除：24 行
    - 净增：20 行
  - 可维护性总结：`spawnManagedService` 现在直接复用统一 CLI entry 解析能力，系统更接近单一真实启动契约；本次净增长主要来自必要回归测试和参数解构治理，没有把复杂度转移到新的补丁层；后续观察点是如果其它子命令也存在自拼 Node 启动参数，应继续收敛到同一入口解析能力。
