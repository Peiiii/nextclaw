# v0.12.74 config-meta scope desktop validation

## 迭代完成说明（改了什么）
- 调整 `AGENTS.md` 中 `workspace-star-for-internal-packages` 规则的执行方式。
- 移除“内部依赖改动默认强制跑 desktop 打包验证”的硬性要求。
- 改为按影响范围验证：默认仅要求受影响包的 `build/lint/tsc`；仅在触达 desktop 打包链路时才需要 `pnpm desktop:package` + `pnpm desktop:package:verify`。

## 测试/验证/验收方式
- 文档规则结构校验：确认规则条目模板字段完整。
- 语义校验：确认执行方式中已删除“默认强制 desktop 验证”，并保留“desktop 相关时才验证”的条件化约束。

## 发布/部署方式
- 本次为协作规则调整，不涉及代码发布与部署。
- 合并后立即生效。

## 用户/产品视角的验收步骤
- 在后续内部依赖调整任务中，先判断是否触达 desktop 打包链路。
- 若不触达 desktop：执行受影响包 `build/lint/tsc` 即可。
- 若触达 desktop：补充执行 `pnpm desktop:package` + `pnpm desktop:package:verify`。
