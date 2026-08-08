# Windows 服务端路径搜索测试修复

## 迭代完成说明

- 修复服务端路径搜索测试在 Windows GitHub Actions 上对 8.3 短路径的脆弱假设。
- 测试准备阶段改用与生产搜索服务一致的异步 `realpath`，确保输入与响应都采用规范路径。
- 不修改生产逻辑、不放宽响应断言，也不引入平台专属分支。

## 测试/验证/验收方式

- 运行服务端路径 controller 定向测试，确认项目文件搜索、依赖目录排除及响应路径断言通过。
- 运行 `pnpm -C packages/nextclaw-server tsc` 与触达文件定向 ESLint。
- 运行治理、backlog ratchet、generated-artifact clean 与 non-feature maintainability guard。
- Windows 8.3 短路径场景以 GitHub Actions 的 Windows runner 作为最终跨平台证据。

## 发布/部署方式

- 通过独立修复 PR 合入 `master`，由新的主干提交触发桌面端 Windows 验证。
- 本次仅修改测试与迭代记录，不需要 changeset、NPM 发布、数据库 migration、线上部署或 runtime update。

## 用户/产品视角的验收步骤

1. 用户可见行为没有变化，无需产品侧手工验收。
2. 以 Windows CI 中服务端路径搜索测试稳定通过作为验收结果。

## 可维护性总结汇总

- 测试直接遵守生产合同：服务返回规范真实路径，测试输入也先规范化。
- 未通过大小写忽略、短路径兼容 helper 或平台判断掩盖差异。
- 改动只触达一条测试准备语句和对应导入，没有新增生产语义或平行路径。

## NPM 包发布记录

- 不涉及 NPM 包发布；本次没有用户可见变更，也不进入 changelog 或 release notes。
