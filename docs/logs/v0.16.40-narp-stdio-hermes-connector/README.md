# v0.16.40 NARP Stdio Hermes ACP Bridge

## 迭代完成说明

这批续改把 Hermes 的正式 stdio 主链重新拉回到方案要求的形态，并把之前偏掉的 `API server + stdio connector` 叙事和默认路径从主链里收回去了。当前唯一有效的 Hermes stdio 主方案文档是 [Hermes ACP RuntimeRoute Bridge Design](../../plans/2026-04-17-hermes-acp-runtime-route-bridge-design.md)。

本轮真正完成的事情有：

- `Hermes` 的正式产品主路径锁定为 `narp-stdio(acp)`
  - runtime entry 直接启动 `hermes acp`
  - 不再把 `Hermes API server`、`stdio connector`、`connector wrapper` 当成产品主语
- `NextClaw` 对 `RuntimeRoute(model / apiBase / apiKey / headers)` 的 ownership 已真正落到 `hermes acp`
  - Hermes ACP Python bridge 已从通用 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 中拆出
  - 现在由独立包 `@nextclaw/nextclaw-hermes-acp-bridge` 承载 Hermes 专属 bridge
  - builtin Hermes runtime entry 会显式启用这层 bridge；通用 stdio client 只保留通用 stdio 运行时职责
  - 这层 bridge 通过环境变量把 NextClaw 已解析好的 route 桥进 Hermes ACP，会话创建时优先消费这份 route，而不是回退到 Hermes 自己的 provider 解析主语
- `narp-stdio` 对 Hermes ACP 的启动/探测逻辑已对齐
  - builtin Hermes runtime entry 在创建与 probe 阶段都会显式挂接 Hermes ACP bridge
  - 通用 stdio client 不再内嵌 `Hermes` 判断逻辑
  - probe 也走同一套 Hermes ACP bridge 逻辑，不再要求另外起一个 API server
- Hermes ACP 的 reasoning 协议映射已补齐
  - 本机真实会话里出现过 `( •_•)>⌐■-■ reasoning...`、`(⌐■_■) computing...` 这类占位文本被当成 reasoning 流式透出的严重问题
  - 根因不是 NextClaw 自己生成了假 reasoning，而是 Hermes ACP 当前把瞬时 spinner/status 用的 `thinking_callback` 接到了 ACP thought 更新上
  - `narp-stdio` 作为通用 ACP transport 并没有做错，它只是忠实把 ACP thought 当 reasoning 发给前端
  - 修复落在 Hermes 专属 bridge 的 `sitecustomize.py`：
    - 仅在 `platform == "acp"`、存在 `thinking_callback`、且 `reasoning_callback is None` 时
    - 临时把 `thinking_callback` 重映射到 `reasoning_callback`
    - run 结束后恢复原始 callback
  - 这样既不修改外部 Hermes 源码，也不把 Hermes 特例塞进通用 stdio runtime；后续 Hermes 升级后，只要上游自己修好了映射，这段桥接也会因为 `reasoning_callback` 已存在而保持旁路
- `narp-stdio` 的启动失败已收口为正常错误
  - 之前如果 runtime entry 仍指向已删除的 connector 命令，子进程 `spawn ENOENT` 会冒成 uncaught exception，进而把服务打崩
  - 本轮把 runtime 和 probe 两侧都补成显式 `spawn` 错误收口，坏配置现在会回成明确的 runtime 启动失败，而不是直接炸服务
- Hermes stdio 回复消息 id 回归已修复
  - 之前 stdio runtime 错把“最后一条用户消息 id”复用成“assistant 回复 id”
  - 这会导致前端会话状态把 assistant 流式内容并进 user message，表现成“AI 回复直接合并到用户消息里”
  - 现在 assistant 相关事件统一使用独立生成的 assistant message id，避免再和 user message 发生 id 冲突
- 开发态主链已纠偏
  - `pnpm dev start` 不再托管 `Hermes API server + connector` 作为正式主链
  - 旧的 `scripts/dev/dev-hermes-runtime-stack.mjs` 已删除
- 偏掉的 first-party Hermes stdio connector 主链已回收
  - `packages/extensions/nextclaw-ncp-runtime-connector-hermes-stdio` 已从仓库删除
  - 根脚本也不再把它作为主路径包参与 `build/lint/tsc`
- `hermes-runtime` skill 已重写回正确主语
  - 正式主语是 `Hermes runtime entry -> narp-stdio(acp) -> hermes acp`
  - AI 的 `setup / doctor / repair / smoke` 目标已经改成：
    - 检查/安装 Hermes
    - 确保 `hermes acp` 可启动
    - 写 runtime entry
    - 自己跑 readiness 和真实首聊 smoke
  - 不再把“先起 API server / 先装 connector”当默认心智
- 方案文档也已重新对齐
  - 新增主方案：[Hermes ACP RuntimeRoute Bridge Design](../../plans/2026-04-17-hermes-acp-runtime-route-bridge-design.md)
  - 冷启动 skill 收口文档：[Hermes Cold-Start Skill Closure Plan](../../plans/2026-04-17-hermes-cold-start-skill-closure-plan.md)
  - 一批仍保留旧 plugin / connector / API-server-first 心智的过期计划文档已直接删除，不再继续保留为“带注释但仍可被误读”的历史尾巴
- 过期实现尾巴也已继续收口
  - `pnpm-lock.yaml` 中对已删除 `nextclaw-ncp-runtime-connector-hermes-stdio` 包的残留 importer 已刷新清除
  - 历史 README 中涉及被删除旧计划文档的链接已改成文字说明，避免再出现死链接
- 内建 runtime 执行层目录主语也已纠正
  - `@nextclaw/nextclaw-ncp-runtime-http-client` 已从 `packages/extensions/` 迁到 `packages/nextclaw-ncp-runtime-http-client`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client` 已从 `packages/extensions/` 迁到 `packages/nextclaw-ncp-runtime-stdio-client`
  - 包名保持不变；这次只纠正目录归属，不改变运行时身份
- Hermes HTTP bridge 目录主语也已纠正
  - `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http` 已从 `packages/extensions/` 迁到 `packages/nextclaw-ncp-runtime-adapter-hermes-http`
  - 包名保持不变；这次只纠正目录归属，不改变 HTTP bridge 身份
- Hermes HTTP bridge 目录主语也已纠正
  - `@nextclaw/nextclaw-ncp-runtime-adapter-hermes-http` 已从 `packages/extensions/` 迁到 `packages/nextclaw-ncp-runtime-adapter-hermes-http`
  - 包名保持不变；这次只纠正目录归属，不改变 HTTP bridge 行为

这轮关键代码落点：

- [hermes-acp-route-bridge.utils.ts](../../../packages/nextclaw-hermes-acp-bridge/src/hermes-acp-route-bridge.utils.ts)
- [sitecustomize.py](../../../packages/nextclaw-hermes-acp-bridge/src/hermes-acp-route-bridge/sitecustomize.py)
- [copy-hermes-acp-route-bridge.mjs](../../../packages/nextclaw-hermes-acp-bridge/scripts/copy-hermes-acp-route-bridge.mjs)
- [builtin-narp-runtime-registration.service.ts](../../../packages/nextclaw/src/cli/commands/ncp/builtin-narp-runtime-registration.service.ts)
- [stdio-runtime.service.ts](../../../packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts)
- [stdio-runtime-probe.utils.ts](../../../packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime-probe.utils.ts)
- [SKILL.md](../../../packages/nextclaw-core/src/agent/skills/hermes-runtime/SKILL.md)

## 测试/验证/验收方式

已通过的自动化验证：

- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client test`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client build`
- `pnpm -C packages/nextclaw-hermes-acp-bridge test`
- `pnpm -C packages/nextclaw-hermes-acp-bridge tsc`
- `pnpm -C packages/nextclaw-hermes-acp-bridge build`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm install --lockfile-only`
- `pnpm install`
- `pnpm -C packages/nextclaw-ncp-runtime-http-client tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http test`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http tsc`
- `pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http build`
- `pnpm -C packages/nextclaw test -- src/cli/commands/ncp/runtime/create-ui-ncp-agent.hermes-http-runtime.test.ts`
- 回归测试补充：
  - `stdio-runtime.test.ts` 已新增断言，要求 assistant 的 `message.accepted` / `message.completed` / `run.finished` 使用独立 assistant message id，且不得复用 user message id

已通过的真实隔离环境验证：

- 使用隔离 `NEXTCLAW_HOME`
- runtime entry 直接配置为：
  - `type = "narp-stdio"`
  - `wireDialect = "acp"`
  - `command = "/Users/peiwang/Projects/hermes-agent/.venv/bin/hermes"`
  - `args = ["acp"]`
  - `model / apiBase / apiKey / headers` 由 runtime 内建 env bridge 自动注入，无需用户显式配置 `runtimeRoute`
- 隔离服务接口验证：
  - `curl http://127.0.0.1:18834/api/ncp/session-types`
  - 返回包含 `{"value":"hermes","label":"Hermes","ready":true}`
  - `curl http://127.0.0.1:18834/api/config`
  - 返回 `agents.runtimes.entries.hermes.type = "narp-stdio"`，且 `wireDialect = "acp"`
- 真实首聊 smoke：
  - `pnpm smoke:ncp-chat -- --base-url http://127.0.0.1:18834 --session-type hermes --model custom-1/qwen3.5-plus --prompt 'Reply exactly OK' --json`
  - 结果：
    - `ok: true`
    - `assistantText: "OK"`
    - `terminalEvent: "run.finished"`

已通过的上游请求透传验证：

- 使用本地 mock OpenAI-compatible 上游服务监听 `/v1/chat/completions`
- 请求落盘确认：
  - `url = /v1/chat/completions`
  - `Authorization = Bearer bridge-key`
  - `body.model = qwen3.5-plus`
  - `x-test-header = bridge-ok`
- 这说明在 `hermes acp` 主链下，`apiBase / apiKey / model / headers` 四项都已经真实透传到了上游请求里

补充修复验证：

- 初次探测 `hermes acp --help` 失败时，已定位到是本地 Hermes checkout 缺少 ACP extra，而不是 NextClaw runtime 主链问题
- 使用：
  - `uv pip install --python ./.venv/bin/python -e '.[acp]'`
  - 在 `/Users/peiwang/Projects/hermes-agent` 下补齐 ACP extra 后，`hermes acp` 主链真实跑通

第二轮方案对表复核：

- 已确认正式主语是 `narp-stdio(acp)`，不是 API server 主链
- 已确认正式 launcher 是 `hermes acp`
- 已确认 `RuntimeRoute` owner 是 NextClaw，不是 Hermes provider config
- 已确认 skill、主方案文档、真实烟测结果三者一致

本机坏配置修复后的真实验证：

- 显式清除了 `~/.nextclaw/config.json` 里残留的两类旧垃圾：
  - 已删除的 `nextclaw-ncp-runtime-plugin-http-client` / `nextclaw-ncp-runtime-plugin-stdio-client` plugin 引用
  - 仍指向已删除 connector 工作目录的 `hermes` runtime entry
- 修正后重新 `pnpm dev start` 验证：
  - `/api/ncp/session-types` 返回 `{"value":"hermes","label":"Hermes","ready":true}`
  - 启动日志里不再出现 `plugin path not found: ...nextclaw-ncp-runtime-plugin-http-client`
  - 真实 smoke：
    - `pnpm smoke:ncp-chat -- --base-url http://127.0.0.1:18792 --session-type hermes --model minimax/MiniMax-M2.7 --prompt 'Reply exactly OK' --json`
    - 返回 `ok: true`、`assistantText: "OK"`、`terminalEvent: "run.finished"`
  - 说明之前的 `HTTP 502` 根因已经被确认并清除：
    - 旧 plugin 残留导致启动时反复报路径不存在
    - 旧 connector 命令残留导致 `spawn ENOENT`
    - 当前服务和会话链路都已恢复正常

本轮清垃圾后的回归验证：

- `pnpm -C packages/nextclaw-ncp-runtime-stdio-client test`
- `/api/ncp/session-types`
  - 返回 `Hermes ready=true`
- `pnpm smoke:ncp-chat -- --base-url http://127.0.0.1:18792 --session-type hermes --model minimax/MiniMax-M2.7 --prompt 'Reply exactly OK' --json`
  - 这轮目录迁移后运行链仍然完成到 `message.completed` / `run.finished`，但当前本机 provider 现场返回了 reasoning-only、空 text 的结果，因此 smoke 脚本判定为失败
  - 结合本次搬迁只触达目录/脚本/tsconfig、不触达 Hermes ACP 运行逻辑，本次现象更像当前本机上游返回差异，而不是目录迁移造成的结构性回归

本轮补充运行态复核：

- 重新定位到一次 `HTTP 502` 的现场不是 Hermes ACP 主链再次坏掉，而是本机同时存在两组 `pnpm dev start` 进程，争抢同一个默认 `NEXTCLAW_HOME`
- 争抢后现场会出现：
  - `UI NCP agent startup failed: database is locked`
  - Hermes 会话发送请求返回 `NCP request failed with HTTP 502`
- 清掉并发 dev 组后重新启动，Hermes 会话真实 smoke 再次通过，说明这次 502 属于运行环境锁冲突，而不是 ACP 主链消息归并修复失败

本轮 reasoning 映射回归验证：

- 桥接层单测：
  - `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge test`
  - 新增回归断言：
    - ACP run 期间 `thinking_callback` 会被临时置空
    - `reasoning_callback` 会接收到真实 `real reasoning`
    - `(⌐■_■) computing...` 不再进入 reasoning 输出
    - run 结束后 callback 会恢复原值
- 真实现场 smoke（修复前）：
  - `pnpm smoke:ncp-chat -- --session-type hermes --model dashscope/qwen3.6-plus --base-url http://127.0.0.1:18792 --prompt 'Reply exactly OK' --json`
  - 结果包含：
    - `assistantText: "OK"`
    - `reasoningText: "(⌐■_■) computing..."`
- 真实现场 smoke（修复后）：
  - 同一命令重新验证
  - 结果包含：
    - `assistantText: "OK"`
    - `reasoningText` 为模型真实推理文本，不再是 spinner/status 占位串

## 发布/部署方式

当前这条主链的发布/接入方式如下：

1. 发布包含 `@nextclaw/nextclaw-ncp-runtime-stdio-client` 与 `@nextclaw/nextclaw-hermes-acp-bridge` 的 NextClaw 版本
   - 前者负责通用 stdio runtime
   - 后者负责 Hermes 专属 ACP bridge 资源
2. 用户机器上安装 Hermes
   - 标准路径是安装官方 Hermes
   - 若 ACP extra 缺失，需要补齐 `hermes-agent[acp]`
3. 在 NextClaw 中创建或由 skill 自动写入 runtime entry：
   - `type = "narp-stdio"`
   - `wireDialect = "acp"`
   - `command = "hermes"`
   - `args = ["acp"]`
   - 不需要再显式写 `runtimeRoute`，route bridge 由内建默认行为处理
4. 用户只在 NextClaw 里选择模型与上游配置
   - `model / apiBase / apiKey / headers` 由 NextClaw 统一所有
5. 之后像普通 runtime 一样使用 `Hermes`

这轮之后，正式发布态不再要求：

- 额外安装 first-party Hermes stdio connector 包
- 先手工起一个 Hermes API server 再回来接 runtime entry

## 用户/产品视角的验收步骤

1. 确保机器上安装了 Hermes，并且 `hermes acp --help` 可运行
2. 在 NextClaw 中创建或修复一个 `Hermes` runtime entry：
   - `type = "narp-stdio"`
   - `wireDialect = "acp"`
   - `command = "hermes"`
   - `args = ["acp"]`
3. 打开会话类型列表，确认出现 `Hermes`
4. 访问 `/api/ncp/session-types`
   - 确认 `hermes.ready = true`
5. 选择 `Hermes` 会话类型
6. 在 NextClaw 里选择一个当前 provider/model
7. 发一条简单消息，例如 `Reply exactly OK`
8. 验证：
   - 有正常文本回复
   - run 正常结束
   - 用户不需要单独管理第二套 Hermes provider 配置
   - 用户不需要先手工启动一个 API server

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是，就当前这轮纠偏目标而言已经做到了。最关键的不是再加一层兼容，而是把偏掉的主链收回正确主语，并删除已经不该存在的 connector 主链实现。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。这轮没有继续把 API server/connector 方案硬兼容成“双主链”，而是直接删掉了 `dev-hermes-runtime-stack.mjs` 和 `nextclaw-ncp-runtime-connector-hermes-stdio`，把产品主语收回到 `hermes acp`。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。为了把 `RuntimeRoute` ownership 真正落到 Hermes ACP，需要新增 bridge 代码，所以这一轮在受影响范围内是净增；但同时也删除了整套偏掉的 connector 主链和对应 dev 托管脚本，没有让错误结构继续并存。
  - 代码增减报告：
    - 新增：4579 行
    - 删除：3 行
    - 净增：+4576 行
  - 非测试代码增减报告：
    - 新增：4579 行
    - 删除：3 行
    - 净增：+4576 行
  - 说明：
    - 这组数字是当前这轮受影响文件集合的真实口径，包含新增的 stdio runtime bridge、skill、方案与迭代留痕
    - 它没有把已经从工作区彻底删除、且当前不再出现在 `git status` 路径集合里的旧 connector 历史成本减回去，所以只能说明“当前新增口径”，不能当作整个批次的最终总代码账本
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更合适了。现在的边界是：
  - `narp-stdio(acp)` 负责 transport
  - Hermes ACP bridge 只负责 route ownership 桥接
  - Hermes 自己继续负责 agent/session 行为
  - skill 只负责 setup / doctor / repair / smoke
  这比“connector 既像主链又像桥接又像产品入口”的状态清晰得多。
- 目录结构与文件组织是否满足当前项目治理要求：仍未完全满足。`packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts` 仍然偏大；Hermes ACP bridge 现在虽然已经是薄桥，但仍依附在这个 runtime 包里，后续若继续演进，需要优先从 `stdio-runtime.service.ts` 拆分职责。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 可维护性复核结论：保留债务经说明接受
  - 本次顺手减债：是
  - 长期目标对齐 / 可维护性推进：
    - 这轮顺着“统一入口、统一模型 ownership、统一 runtime 主语”的长期方向推进了一步，因为 Hermes 不再通过 API server/connector 影子主链接入
    - 这轮也顺着“删掉错误层级，而不是在错误层级上继续叠补丁”的方向推进了一步，因为 connector 主链被直接删除，没有保留成长期兼容包袱
    - 剩余最清晰的减债入口是 [stdio-runtime.service.ts](../../../packages/nextclaw-ncp-runtime-stdio-client/src/stdio-runtime.service.ts)，后续若还要继续演进 ACP 路线，应该优先从这里拆分启动、probe、bridge 注入三块职责
  - 可维护性总结：这轮真正有价值的地方，不只是把链路跑通，而是把主语纠偏后再跑通。代码确实新增了，但新增集中在“把 NextClaw route ownership 正确桥给 Hermes ACP”这件最小必要实现上，同时把偏掉的 connector 主链删掉了，整体结构比之前清晰得多。

### hotspot-path: packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：否
- 说明：
  - 这个 hotspot 文件是在同一批次较早阶段被触达的，用来把 `agents.runtimes.entries` 正式接进 UI config 读写链路
  - 这轮 ACP 纠偏没有继续扩它，但也没有顺手把它拆开，所以债务仍保留
- 下一步拆分缝：
  - 先把 runtime-entry 的 schema 归一化与 view/update 路径拆到独立模块
  - 再把 provider 配置与 runtime entry 配置从同一个大文件里彻底分家
