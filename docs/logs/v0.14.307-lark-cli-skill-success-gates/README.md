# v0.14.307-lark-cli-skill-success-gates

## 迭代完成说明

- 更新 [`skills/lark-cli/SKILL.md`](../../../skills/lark-cli/SKILL.md)
  - 补充 `config init --new` 与 `auth login` 的可观察成功门槛，避免把“打开浏览器”或“终端仍在等待”误判成成功。
  - 增加单一状态机约束：`CLI missing -> config missing -> config in progress -> login missing -> login in progress -> ready`，避免 agent 重复发起新的配置或授权流程导致循环。
  - 增加任务域的验证规则：`task +get-my-tasks` 仅表示“分配给我”的任务；创建任务后的验证应优先使用返回的 `guid` 调 `task tasks get`，而不是模糊搜索或错误列表入口。
  - 明确推荐 agent 场景优先使用 `auth login --no-wait --json` + `auth login --device-code <DEVICE_CODE>` 的二段式登录方式。
  - 追加“傻瓜式”接入顺序：先确认 NextClaw 工作区 `skills/lark-cli/SKILL.md`，再确认 `lark-cli` 可执行文件与 PATH，再按 `config show -> auth status -> doctor -> config init --new -> auth login -> contact +get-user` 的固定顺序执行。
  - 追加禁止事项：禁止把 `npx skills add larksuite/cli -y -g` 当成 NextClaw skill 安装；禁止在已有等待态时重复发起第二个 `config init` 或 `auth login`。

## 测试/验证/验收方式

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/lark-cli
```

```bash
PATH=/opt/homebrew/bin:$PATH \
LARKSUITE_CLI_CONFIG_DIR=/tmp/lark-cli-live/config \
node /tmp/lark-cli-smoke.0wB57G/node_modules/@larksuite/cli/scripts/run.js auth status
```

```bash
PATH=/opt/homebrew/bin:$PATH \
LARKSUITE_CLI_CONFIG_DIR=/tmp/lark-cli-live/config \
node /tmp/lark-cli-smoke.0wB57G/node_modules/@larksuite/cli/scripts/run.js task tasks get --params '{"task_guid":"6ff2ef6d-017f-48aa-b5b9-552f503e904e"}' --format json
```

```bash
PATH=$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH \
lark-cli config show
```

```bash
PATH=$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH \
lark-cli auth status
```

```bash
PATH=$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH \
lark-cli doctor
```

```bash
PATH=$HOME/.nvm/versions/node/v22.16.0/bin:/opt/homebrew/bin:/usr/local/bin:$PATH \
lark-cli contact +get-user --format json
```

- 预期：
  - marketplace skill 校验通过。
  - `auth status` 显示 `identity: "user"`。
  - `task tasks get` 能回读真实创建的待办。
  - `config show` 显示具体 `appId`。
  - `doctor` 显示 `config_file/app_resolved/token_exists/token_local/token_verified` 全部 `pass`。
  - `contact +get-user --format json` 返回 `"ok": true`、`"identity": "user"` 和真实 `open_id`。

## 实际上架与验证记录（本次）

- **Update**：`node packages/nextclaw/dist/cli/index.js skills update skills/lark-cli --meta skills/lark-cli/marketplace.json --api-base https://marketplace-api.nextclaw.io`
  - 输出：`✓ Updated skill: lark-cli`，`Files: 2`
- **远端条目**：`GET https://marketplace-api.nextclaw.io/api/v1/skills/items/lark-cli`
  - 返回 `200`，`ok: true`，`install.kind=marketplace`
- **安装冒烟**：在 `/tmp/nextclaw-marketplace-skill.jlPzH6` 执行 `skills install lark-cli`
  - 安装成功，产物包含 `SKILL.md` 与 `marketplace.json`
  - 实际安装下来的 `SKILL.md` 已包含新增的成功门槛、反循环状态机与任务验证规则，说明 marketplace 内容已同步到最新版本
- **本次续更（2026-03-31 17:46:04 +0800）**：
  - 真实跑通了 `lark-cli` 首次配置：
    - `lark-cli config init --new` 成功，`config show` 显示 `appId: cli_a9412aa4b73a9bc2`
  - 真实跑通了用户登录：
    - `lark-cli auth login --recommend --no-wait --json`
    - `lark-cli auth login --device-code <DEVICE_CODE>`
    - `auth status` 显示 `identity: "user"`，用户为 `Pei (ou_b3decabc4be7a0d3bc0021a1261bf786)`
  - 真实只读冒烟通过：
    - `lark-cli contact +get-user --format json` 返回 `"ok": true`，且包含真实用户 `open_id`
  - marketplace 已同步本轮新增的“Deterministic Integration Recipe / One-Pass Checklist For Agents / Do Not Do These Things”
    - 远端 `updatedAt` 为 `2026-03-31T09:45:39.997Z`
    - 在 `/tmp/nextclaw-marketplace-skill.RohySF` 的安装冒烟中，安装下来的 `SKILL.md` 已包含：
      - `Deterministic Integration Recipe`
      - `One-Pass Checklist For Agents`
      - `lark-cli contact +get-user --format json`

## 发布/部署方式

- 本次仅更新本地 skill 文案与执行规则。
- 若需要同步 marketplace，执行：

```bash
node packages/nextclaw/dist/cli/index.js skills update skills/lark-cli --meta skills/lark-cli/marketplace.json --api-base https://marketplace-api.nextclaw.io
```

## 用户/产品视角的验收步骤

1. 在 NextClaw 中安装或使用 `lark-cli` skill。
2. 让助手走一次真实 `config init --new`，确认它不会在配置等待中重复发起新的配置流程。
3. 让助手走一次真实 `auth login --no-wait --json` + `auth login --device-code ...`，确认它以 `auth status` 的 `identity: "user"` 作为成功标准。
4. 让助手在登录成功后先跑一次 `lark-cli contact +get-user --format json`，确认不是只有 token 存在，而是真实 API 可读。
5. 让助手创建一个待办后，确认它用返回的 `guid` 调详情接口做验证，而不是仅依赖 `+get-my-tasks`。
