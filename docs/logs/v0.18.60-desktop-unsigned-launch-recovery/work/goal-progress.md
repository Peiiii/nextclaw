# Goal Progress

## 当前目标
修复桌面版真实用户数据目录启动失败，并把验收提升为日志可观测、接口健康、真实 AI 回复全部通过。

## 明确非目标
不把 isolated smoke、codesign 通过或 release 目录直接启动冒充用户真实安装链路通过；不无声绕过 macOS unsigned 系统批准。

## 冻结边界 / 不变量
- 验证必须覆盖 `/Users/peiwang/Library/Application Support/@nextclaw/desktop`。
- 失败日志必须能看到 `ENAMETOOLONG` / `ENOTEMPTY` / `ERR_FAILED` 等关键错误。
- 通过标准包含 runtime health、窗口 ready/load、NCP chat 真实 assistant 回复。
- 真实链路不通过时不得交付“已修复”。

## 已完成进展
- 明确之前失败原因：验证口径只覆盖局部干净链路，没有把真实数据目录、日志窗口和 AI 回复作为 gate。
- 修复 staging trash 无限嵌套：清理 `staging/.trash-*` 时直接删除，不再二次改名成 `.trash-staging-.trash-staging-*`。
- 修复同版本 quarantined packaged seed 重试：launcher 壳层变化后允许同 seed 重试，并在重试前替换旧 `0.19.6` 目录。
- 真实桌面数据目录已恢复：`/Users/peiwang/Library/Application Support/@nextclaw/desktop/staging` 清空，`0.19.6` 标记 healthy。
- real-profile DMG smoke 已通过：从 DMG 临时安装、真实桌面数据目录、GUI `ready-to-show` / `did-finish-load`、health API 全部通过，约 10.1s ready。
- GUI-launched runtime AI smoke 已通过：`/api/health` ok，`pnpm smoke:ncp-chat` 拿到 `NEXTCLAW_DESKTOP_GUI_AI_OK` assistant 回复。
- release guard 已补上日志检查、real profile、AI 回复 gate，避免再次把局部 smoke 当成交付完成。
- 进一步沉淀到 skill：`desktop-release-contract-guard` 新增 local handoff validation ladder 与 failure triage playbook；`unsigned-desktop-release-playbook` 新增 unsigned trust 与 product startup 的边界规则。

## 当前下一步
完成 skill 文档检查与最终说明。

## 锚点计数器
5/20
