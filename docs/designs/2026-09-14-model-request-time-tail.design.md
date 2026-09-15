# 每次模型请求的时间尾部上下文

NC-181；standard / L2；单批实现，plan=not-required。用户已明确接受：每次喂给模型的上下文最后附加当前时间和时区，不写入历史，不依赖工具调用。

## 用户链路与范围

用户直接聊天或让 Agent 执行工具，模型每次接收请求时都获得此刻的时间；下一轮和运行时重试刷新时间。历史记录只保留原本的消息，动态时间不累积。复用 NextClaw 原生模型请求的 context tail；外部 SDK 自己发出的模型请求不受此发送边界控制，不改写其会话历史来模拟 tail。

时间来自运行 NextClaw 的宿主时钟：UTC ISO 时间、宿主 IANA 时区、当时的 UTC 偏移；不擅自认定宿主时区就是用户所在地。无新 CLI 或配置，现有 Agent 调用自动生效。

## 证据与方案

现有 `RequestContextTailManager` 在每轮 model-input build 时收集 observation 等内容，builder 为 tail 预留 token，`ProviderManagerNcpLLMApi.generate` 才把 tail 序列化为最后一条临时模型消息。会话状态没有接收此追加消息。运行时 `runModelRoundWithRecovery` 会重复调用 generate，复用 modelInput，因此仅注册普通时间 provider 不能覆盖重试刷新。

在现有 `agent-model-input-tail.utils.ts` 增加时间 tail 组装函数：返回新的 tail，将单个 trusted current-time section 追加在其他 section 后。发送边界每次 generate 调用它，最后才生成临时消息；不修改 input.messages、input.contextTail 或持久化状态。builder 仅调用同一组装函数计算含时间的预算，返回值仍只携带原请求 tail，不保存该时间快照。两处共享字段/格式 owner，预算采样不代表最终发送时间。

不增加独立 provider 注册体系或协议字段。与在系统前缀注入相比，本方案不改动稳定前缀；与普通 provider 注册相比，真正发送前采样覆盖重试。前缀字节稳定可由测试证明，实际供应商缓存命中率不作无测量承诺。

## 验收与黄金路径

1. 同一原始输入在两个不同时刻调用真实 generate adapter，截获供应商边界请求：最后一条包含各自时间，仅一个 current-time section，前方消息逐项完全相同；覆盖无工具和工具返回后的输入。
2. 原始 messages 与 contextTail 深度冻结后仍可发送；请求后及 JSON 历史往返均无时间注入，已有 observation tail 原样保留且位于时间前。
3. 时区测试覆盖 UTC、正/负偏移及夏令时日期；预算包含新增时间 token，kernel tsc、定向 lint 与边界测试通过。

AI 通过真实组装边界测试证明内容、位置、刷新和无历史污染，不需用户手动验证消息隐藏字段；不声称完成外部 SDK 或线上缓存率验证。交付独立 worktree 未提交源码，未获 commit/push/release 授权。

## 方案审查

design-review: passed。用户结果、尾部顺序、重试、预算、时区和历史隔离已覆盖；复用同一 tail 语义，无新增状态 owner，无开放 finding。

## 验证与交接

- Kernel 定向测试：3 文件、21 项通过。新增供应商发送边界验证复用同一 frozen input 两次发送时，时间刷新、消息前缀不变、尾部仅一个时间 section；覆盖无其他 tail 的普通对话和携带工具结果/observation 的输入。
- UTC、上海、纽约冬/夏令时、阿德莱德半小时时区偏移通过；模型输入预算包含时间成本，但返回的输入快照不保存时间 section。
- `pnpm -C packages/nextclaw-kernel tsc` 通过；5 个触达 TypeScript 文件定向 ESLint 通过；`git diff --check` 通过。
- diff-only maintainability：0 error，1 warning（既有 builder 测试文件 768 → 773 行，低于 900 行预算）。主观复核通过：补充既有预算测试的断言无需拆出重复 fixture，无开放 finding。
- 验证使用真实请求组装代码与截获的供应商边界输入；没有测量线上供应商缓存命中率，也没有验证外部 SDK 自主发送请求。稳定前缀保持一致不等同于承诺缓存命中率。
- 改动位于 `/Users/peiwang/Projects/nextbot-nc-181-tool-result-time`，未提交、合并或发布；主工作区其他任务的改动未触碰。
- 复盘：原需求误解已通过 Linear 描述修正与本设计消除；时间必须是发送时的临时上下文事实，不能混入工具结果或历史。该约束已由发送边界测试保护，不另建通用规则。
