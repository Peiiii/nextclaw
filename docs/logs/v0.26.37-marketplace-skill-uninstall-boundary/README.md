# v0.26.37 Marketplace Skill Uninstall Boundary

## 迭代完成说明

- 根因：Marketplace skill 卸载链路把请求中的标识直接参与文件系统路径计算，递归删除前没有验证目标是否仍是 `workspace/skills` 的直属 skill 目录。
- 确认方式：沿 `POST /api/marketplace/skills/manage` 到 `ServiceMarketplaceInstaller` 的完整调用链检查，并通过隔离临时目录中的 HTTP 回归测试复现越界目标可被接受。
- 修复方式：在实际删除 owner 中同时执行 skill 标识校验、路径解析和直属子目录校验，保证安全约束与递归删除位于同一信任边界；没有把校验只放在 UI 或路由层。
- Skill 来源边界：NextClaw 还会加载 project、global 与 builtin skill；本次约束只定义 Marketplace UI 对 workspace skill 的卸载所有权，不表示所有 skill 都位于 `workspace/skills`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service exec vitest run src/services/marketplace/service-marketplace-installer.service.test.ts src/services/marketplace/marketplace-skill-args.service.test.ts src/services/marketplace/marketplace-summary.service.test.ts src/utils/marketplace/marketplace-identity.utils.test.ts src/controllers/commands/marketplace-skill-install-command.controller.test.ts`
- `pnpm --filter @nextclaw/server exec vitest run src/app/router.marketplace-manage.test.ts`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --no-fail --paths packages/nextclaw-service/src/services/marketplace/service-marketplace-installer.service.ts packages/nextclaw-service/src/services/marketplace/service-marketplace-installer.service.test.ts`
- 验证结果：service 相关测试 `25` 个通过，server 路由测试 `5` 个通过，TypeScript 编译和增量治理通过；service lint 为 `0` error、`9` 条既有 warning。

## 发布/部署方式

- 本轮创建本地提交，不推送、不部署。
- 修复应先通过私下协调完成复核，再随 `@nextclaw/service` 与 `nextclaw` 的 patch 版本统一发布。

## 用户/产品视角的验收步骤

1. 在 Marketplace 卸载一个 workspace 中已安装的直属 skill，接口返回成功且仅该 skill 目录被删除。
2. 提交点目录、父目录、斜杠或反斜杠路径形式的卸载目标，接口返回 `400 MANAGE_FAILED`。
3. 确认 workspace 中的其他 skill 和相邻文件保持不变。
4. 确认 project、global 与 builtin skill 的加载行为不受本次 workspace 卸载边界影响。

## 可维护性总结汇总

- 删除 owner 更清晰：路径解析、边界验证和递归删除均位于 `ServiceMarketplaceInstaller`，没有新增平行校验层或辅助包装。
- 触达的 installer class 已按仓库规则统一为箭头 class field，并用直接方法引用替代 `createInstaller` 中的转发闭包。
- 新增装配式 HTTP 回归测试覆盖拒绝路径、响应合同、文件保留和合法卸载。
- 非测试语义代码净增预计为 `+4`。这是递归删除前所需的显式安全不变量；已检查当前方法、当前 class 和同一 Marketplace 卸载责任链，没有可安全删除且不削弱可读性或行为的旧分支。
- Line-growth exemption：记录并接受上述 `+4` 必要增长。继续压缩只能折叠显式边界判断或删除既有错误语义，会降低安全性和可维护性。
- Maintainability guard：总代码 `+190/-33`、净增 `+157`；非测试代码 `+37/-33`、净增 `+4`；无文件、目录、函数、命名或红区 warning，唯一 error 为已在本记录显式接受的必要 line-growth exemption。
- 主观复核：没有新增 helper、wrapper、平行校验层或新目录层级；破坏性文件操作的 owner 和安全不变量更集中，测试文件低于测试预算。

## NPM 包发布记录

- 需要发布：`@nextclaw/service` patch、`nextclaw` patch。
- 当前状态：本地修复与 changeset 已纳入提交，待私下复核后统一发布。
