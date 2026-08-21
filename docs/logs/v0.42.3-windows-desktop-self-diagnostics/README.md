# Windows Desktop 自诊断与自治恢复

## 迭代完成说明

本次把 Windows Desktop “后台突然没了、重启后不知道原因”的诊断能力做成默认内置链路：Desktop 在启动、正常退出、主进程异常、renderer/GPU/runtime 子进程退出时写入本地 host incident journal；独立 guardian 观察非计划退出并有限退避重启；下一次启动关联 Crashpad 与 Windows Application/System/Defender 事件。既有 `nextclaw status --json`、`nextclaw doctor --json` 和 `nextclaw-self-manage` 将最近未解决 incident 提供给 AI 自行调查。

根因不是少了一条普通日志，而是 Desktop 主进程被强制终止时无法写尾日志，且此前没有跨重启的事实 owner、外部观察者和 AI 可消费投影。该结论由原有 Electron 生命周期、runtime 子进程日志和 CLI 诊断链路的端到端调查确认。本次修复把事实采集、归因、恢复和 AI consumer 分别收敛到 Desktop、Core、Service 的唯一 owner，而不是让用户手工找日志。

默认 Windows 证据不能保证记录任意进程终止调用者；没有直接证据时只输出 `external-termination-suspected` 或 `unknown-unclean-exit`，不会声称知道“是谁杀的”。

相关设计：[Windows Desktop 自诊断与自治恢复设计](/Users/peiwang/Projects/nextbot/docs/designs/2026-08-21-windows-desktop-self-diagnostics.design.md)。

## 测试/验证/验收方式

已通过：

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core build`
- `pnpm -C packages/nextclaw-core exec vitest run src/shared/lib/logging/host-incident.service.test.ts`（4 项）
- `pnpm -C apps/desktop build:main`
- `node --test apps/desktop/dist/src/launcher/desktop-guardian.service.test.js apps/desktop/dist/src/utils/windows-host-evidence.utils.test.js apps/desktop/dist/src/services/desktop-host-diagnostics.service.test.js`（5 项）
- `pnpm -C apps/desktop lint`
- `pnpm -C apps/desktop tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-service exec vitest run src/services/diagnostics/diagnostics-commands.service.test.ts`（3 项）
- `git diff --check`
- `check-maintainability.mjs --paths ...`（0 errors）

未在 macOS 开发机上伪造 Windows 原生 Crashpad/事件查看器实机结论；Windows 平台 API 的 XML 解析、时间关联和 incident 回填已由定向测试覆盖，实际 Windows 安装态需在发布验证中复验。

## 发布/部署方式

无迁移、无手动开关、无用户配置步骤。合入并发布包含本次 changeset 的 Desktop、Core、Service 后自动生效；Windows Desktop 首次运行即创建本地 diagnostics 目录。

## 用户/产品视角的验收步骤

1. 在 Windows 安装版启动 NextClaw Desktop，正常退出一次，确认不会产生异常 incident。
2. 模拟 Desktop 主进程非计划退出，确认 guardian 在有限退避内拉起新实例。
3. 重启后向 AI 说“刚才为什么挂了？你自己查一下”，确认 AI 自行读取 `doctor --json` 并先给自然语言结论、恢复状态和置信度。
4. 分别模拟 native crash、系统关机、资源耗尽或 Defender 处置事件，确认 `hostIncident.latest` 给出对应 reason code。
5. 只有缺少直接证据时，确认 AI 明确表示无法证明具体终止者，而非猜测。

## 可维护性总结汇总

本次遵循单一事实 owner：Core 只负责 incident schema/分类/持久化，Desktop 只生产宿主事实，Service 只投影既有 CLI，Skill 只编排既有诊断入口。没有新增平行 Skill 或第二套诊断命令。

自动维护性检查无 errors；提示 `main.ts`、`host-incident.service.ts`、`diagnostics-commands.service.ts` 接近文件预算。经主观复核，这些增量分别留在既有 Desktop 生命周期、单一 journal owner 与既有 CLI owner，当前不存在能减少复杂度的拆分缝；未为压预算引入 wrapper 或重复抽象。目录与文件命名符合治理。

## NPM 包发布记录

需要随统一发布更新：`@nextclaw/desktop`、`@nextclaw/core`、`@nextclaw/service`，状态为“待统一发布”。已添加 changeset；本次未执行发布。
