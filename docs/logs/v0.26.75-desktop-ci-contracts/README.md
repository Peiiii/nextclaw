# 桌面端跨平台 CI 合同修复

## 迭代完成说明

- 修复服务端路径搜索测试在 Windows GitHub Actions 上对 8.3 短路径的脆弱假设。
- 测试准备阶段改用与生产搜索服务一致的异步 `realpath`，确保输入与响应都采用规范路径。
- 修复 `desktop-validate` 的 Linux 打包步骤漏跑 native resource 准备命令，确保 AppImage 携带 `sharp-libvips-linux-x64`。
- 两项修复都复用既有生产或打包 owner，不放宽断言、不新增平台兼容分支，也不复制 native dependency 处理链路。

## 测试/验证/验收方式

- 服务端路径 controller 定向测试通过：23 条通过、2 条跳过；项目文件搜索、依赖目录排除及响应路径断言均已覆盖。
- `pnpm -C packages/nextclaw-server tsc` 与触达文件定向 ESLint 通过。
- `pnpm -r --filter @nextclaw/desktop... build`、治理、backlog ratchet、release summary、generated-artifact clean 与 non-feature maintainability guard 通过。
- PR 的 Windows runner 已证明 server-path 定向测试通过；Linux AppImage 以补充 native resource 准备步骤后的 GitHub Actions 重跑作为最终跨平台证据。

## 发布/部署方式

- 通过独立维护者修复 PR 合入 `master`，由新的主干提交触发桌面端跨平台验证。
- Linux 正式发布工作流已调用相同的 `native-resources` owner；本次修复的是 validate workflow 与正式打包合同的漂移。
- 本次只修改测试、CI 工作流和迭代记录，不需要 changeset、NPM 发布、数据库 migration、线上部署或 runtime update。

## 用户/产品视角的验收步骤

1. 用户可见产品行为没有变化，无需设置页或运行中实例的手工验收。
2. 以 Windows 路径搜索测试、Linux AppImage 启动冒烟及其余桌面跨平台 CI 全部通过作为验收结果。

## 可维护性总结汇总

- 测试直接遵守生产合同：服务返回规范真实路径，测试输入也先规范化。
- Linux validate workflow 复用既有 `native-resources` 命令，与 `desktop-release`、`pack`、`dist` 和 package verify 保持同一 owner。
- 未通过大小写忽略、短路径 helper、`asarUnpack` 补丁或另一套 libvips 复制逻辑掩盖根因。
- 非测试生产代码净增为 0；工作流只新增一条缺失的既有前置命令。

## NPM 包发布记录

- 不涉及 NPM 包发布；本次没有用户可见变更，也不进入 changelog 或 release notes。
