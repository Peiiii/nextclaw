# v0.26.4 Codex 跨模型会话连续性

## 迭代完成说明

- 第一阶段修复了同一个 NextClaw Codex 会话切换模型时隐式创建新 thread 的问题：会话身份只由 `codex_thread_id` 决定，model/provider 只是每轮路由。
- 随后的真实 `Runtime default -> DeepSeek -> Runtime default` 复现证明 thread ID 已保持稳定，但返回默认时仍失败。原始 rollout 显示本轮模型仍为 `deepseek-v4-pro`，说明 app-server 的模型状态具有 thread 粘性，省略 model override 不能表达“恢复默认”。
- 显式切回 `gpt-5.6-sol` 后仍可稳定复现 OpenAI 400：DeepSeek bridge 生成的 reasoning item 含非空 `content`，而 OpenAI 只接受自身加密 reasoning 的该字段。清除该项后，同一 thread 能正常继续，证明这是第二个根因而不是新的 thread 绑定问题。
- app-server 实际通过 `turn/completed(status=failed)` 报告失败；旧 runtime 无条件发出 `run.finished`，因此上层只能显示“ACP 完成但没有 assistant 内容”。本次同时修复终态映射，让原始 provider 错误可观察。
- 最终修复在 app-server runtime 中显式解析并应用默认模型，在 Responses bridge 中统一生成 `summary + content=[]` 的跨 provider reasoning 历史，并删除协议中不存在的 `turn/failed` 分支。
- 没有新增按模型 thread、自动迁移 fallback 或第二套历史链路。尚未发布的旧 bridge 只污染了本机目标会话，因此采用备份后的单次显式修复，不把开发中间态固化成产品兼容代码。

## 测试/验证/验收方式

- 第一阶段定向回归：Codex NARP wrapper 10/10、Codex NCP 相关测试 19/19 通过，并完成 Runtime default 到 MiniMax 的同 thread 冒烟。
- 第二阶段新增 3 类回归合同：运行时默认模型必须通过 `model/list.isDefault` 显式恢复；流式与非流式 bridge reasoning 必须保持 `content=[]`；`turn/completed(status=failed)` 必须映射为 `run.error`。最终定向测试 10/10 通过。
- 原故障 session `ncp-mrtb3ctb-315f5409` 的 rollout、journal、metadata 已备份到 `~/.nextclaw/backups/codex-session-repair-20260720-2250/`。同一 `codex_thread_id=019f7fe1-14fa-74d1-acf1-745b3bda3fcf` 原位修复后，Runtime default 真实消息成功回答上一句“我上面说了什么”。
- 最终实现的全新三段冒烟使用 session `ncp-codex-switch-regression-20260720-2259`：默认模型记住 `白鹭-8316`，DeepSeek 正确读回，切回默认后再次正确读回；三次均以 `run.finished` 结束且 assistant 内容非空。
- 对应 raw rollout 只有一个 thread `019f8009-4c84-7d50-9fc0-885a8d907a98`，模型序列为 `gpt-5.6-sol -> deepseek-v4-pro -> gpt-5.6-sol`；bridge reasoning 为 `summaryCount=1, contentCount=0`。
- 最终完整测试：Codex NCP 7 个文件、23/23；Codex NARP 2 个文件、15/15。两个包的 TypeScript、lint 与生产构建通过；NCP lint 仅保留 1 条未触达文件中的既有 warning。
- Scoped 新代码 governance 与全仓 backlog ratchet 通过，`git diff --check` 通过。

## 发布/部署方式

- `.changeset/keep-codex-session-thread-stable.md` 标记 `@nextclaw/nextclaw-narp-runtime-codex-sdk` 与 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` patch。
- 本次未发布 NPM 包、未部署，也未重启现有 NextClaw 实例。
- 第一阶段使用独立 home 与 `18891` 端口验证；第二阶段复用当前源码开发服务，每次 NARP 子进程退出后由下一轮加载重建产物，没有重启宿主。

## 用户/产品视角的验收步骤

1. 新建 Codex 会话，保持 Runtime default，发送一条要求记住随机标记的消息。
2. 在同一会话切换到 DeepSeek，要求复述标记，确认回答正确。
3. 再切回 Runtime default，重复询问标记，确认仍然正确且没有报错。
4. 查看 session metadata 与 Codex rollout，确认只有一个 `codex_thread_id`，实际模型按三轮顺序变化。

## 可维护性总结汇总

- 第一阶段 `post-edit-maintainability-guard --non-feature` 为总代码净减 33 行、非测试净减 31 行，删除模型作用域身份判断、重复 metadata 写入与 helper。
- 第二阶段生产代码继续净减少：bridge 删除 provider-specific `reasoning_text` 内容与事件，runtime 删除当前协议不存在的 `turn/failed` 路径；app-server runtime 最终 589 行，未超过 600 行预算。
- 默认模型解析、终态判断与 reasoning 历史分别留在真实 owner，没有新增 wrapper、迁移 service、按 provider fallback 或平行状态源。
- 最终 `post-edit-maintainability-guard --non-feature` 检查 5 个 TypeScript 文件：总代码 `+173 / -49 / 净增 124`，非测试代码 `+47 / -49 / 净减 2`，0 error、2 warning。
- 两条 warning 为文件接近预算：app-server runtime 590/600 行、stream writer 385/400 行；前者新增的是默认模型与失败终态合同，后者本次净减 7 行。`post-edit-maintainability-review` 结论为通过，无新增 maintainability finding。

## NPM 包发布记录

- `@nextclaw/nextclaw-narp-runtime-codex-sdk`：npm 当前已发布 `0.2.9`；本次需要 patch，用于保持跨模型 thread 身份，待统一发布。
- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`：npm 当前已发布 `0.2.8`；本次需要 patch，用于恢复默认模型、生成可移植 reasoning 历史并正确上报失败，待统一发布。
- Changeset：`.changeset/keep-codex-session-thread-stable.md`。
- 本次未执行 NPM 发布。
