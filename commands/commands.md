# Commands

- `/new-command`: 新建一条指令的元指令。流程：确认名称、用途、输入格式、输出/期望行为，写入本文件并保持 `AGENTS.md` 索引同步。
- `/config-meta`: 调整或更新 `AGENTS.md` 中的机制/元信息（如规则、流程、索引等）的指令。执行时必须先自行判断：应修正已有规则，还是在 Rulebook/Project Rulebook 中删减/新增规则条目；必须先分析深层原因并优先处理更本质的问题，避免只做表层修补；若已开启深思模式，还需推理用户潜在意图、读懂暗示并直接执行高概率期望动作，以减少沟通成本；并明确变更点与预期影响
- `/check-meta`: 检查 `AGENTS.md` 机制是否自洽、是否符合自身规范的指令。输出需包含发现的问题与修复建议（若无问题需明确说明）。
- `/new-rule`: 创建新规则条目的指令，必须按 Rulebook 模板写全字段并更新 `AGENTS.md` 规则区。
- `/commit`: 进行提交操作（提交信息需使用英文）。
- `/validate`: 对项目进行验证，按改动影响范围执行最小充分验证；仅当改动触达构建/类型/运行链路时，执行 `build`、`lint`、`tsc` 的相关项，必要时补充冒烟测试。执行前需确认验证范围和可跳过项。
- `/release-frontend`: 前端一键发布（仅 UI 变更场景）。输入：`/release-frontend`。输出：生成 UI changeset，并执行 `pnpm release:version` + `pnpm release:publish`，最终发布 `@nextclaw/ui` 与 `nextclaw`。
- `pnpm deploy:llm-api-worker`: LLM API Worker 一键部署命令。输入：`DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker`（或 `pnpm deploy:llm-api-worker -- --api-key ***`）。输出：自动更新 Cloudflare secret `DASHSCOPE_API_KEY` 并部署 `nextclaw-provider-gateway-api`。
- `nextclaw skills install <slug>`：从 NextClaw marketplace 安装 skill。输入：`nextclaw skills install demo --api-base <url>`。输出：下载并落盘 skill 文件到工作区 `skills/<slug>`。
- `nextclaw skills publish <dir>`：上传/创建 marketplace skill。输入：`nextclaw skills publish ./my-skill --slug my-skill --api-base <url> [--token <token>]`。输出：将目录文件打包为 API payload 并执行 `upsert`。
- `nextclaw skills update <dir>`：更新已有 marketplace skill。输入：`nextclaw skills update ./my-skill --slug my-skill --api-base <url> [--token <token>]`。输出：要求目标 skill 已存在后执行更新上载。

（后续指令在此追加，保持格式一致。） 
