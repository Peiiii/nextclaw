# v0.16.77-clawhub-nextclaw-skill

## 迭代完成说明（改了什么）

- 新增 marketplace skill：[`skills/clawhub-nextclaw/SKILL.md`](../../../skills/clawhub-nextclaw/SKILL.md)
- 新增该 skill 的 marketplace 元数据：[`skills/clawhub-nextclaw/marketplace.json`](../../../skills/clawhub-nextclaw/marketplace.json)
- 已将该 skill 发布到 NextClaw marketplace：
  - canonical package：`@nextclaw/clawhub-nextclaw`
  - alias：`clawhub-nextclaw`
- 本次能力定位明确收敛为：
  - 把 `ClawHub` 当作 NextClaw 的外部 skill 来源
  - 通过官方 `clawhub --workdir <workspace> --dir skills ...` 命令，把外部 skill 安装进 NextClaw workspace 的 `skills/` 目录
  - 明确区分 `ClawHub` 与 `NextClaw marketplace`，避免产品边界混淆

### 本次实现中的关键判断

- 一开始曾尝试用一个本地脚本把 `ClawHub` 搜索/安装流程包起来，目的是强制钉住目标目录并兼容没有全局安装 `clawhub` 的环境。
- 之后重新核对了当前 `clawhub@0.9.0` 的真实 CLI 契约，并做了直接命令冒烟，确认它已经原生支持：
  - `--workdir <dir>`
  - `--dir <dir>`
- 因此本次最终命中根因式收敛：**删除多余脚本层，只保留官方命令用法说明。**
- 这样既满足“把 ClawHub 上的 skill 安装到 NextClaw 的 `skills/` 目录”这个目标，也避免额外包装层带来的维护成本。

## 测试/验证/验收方式

### 本地校验

- Marketplace skill 元数据校验：

```bash
python3 .agents/skills/marketplace-skill-publisher/scripts/validate_marketplace_skill.py --skill-dir skills/clawhub-nextclaw
```

- 结果：`Errors: 0`，`Warnings: 0`，`Result: OK`

### 直接命令冒烟

- 真实搜索验证：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-direct-clawhub.XXXXXX)
npm exec --yes clawhub -- --workdir "$tmp_dir" --dir skills search "code review" --limit 2
```

- 结果：成功返回搜索结果，例如 `quack-code-review`、`code-review-fix`

- 真实安装验证：

```bash
npm exec --yes clawhub -- --workdir "$tmp_dir" --dir skills install code-review-assistant
nextclaw skills info code-review-assistant --workdir "$tmp_dir"
```

- 结果：
  - `code-review-assistant` 成功安装到 `"$tmp_dir/skills/code-review-assistant"`
  - `nextclaw skills info` 能把它识别为 `workspace` skill

### 发布与远端校验

- 首次发布：

```bash
nextclaw skills publish skills/clawhub-nextclaw --meta skills/clawhub-nextclaw/marketplace.json --scope nextclaw --api-base https://marketplace-api.nextclaw.io
```

- 后续更新：

```bash
nextclaw skills update skills/clawhub-nextclaw --meta skills/clawhub-nextclaw/marketplace.json --package-name @nextclaw/clawhub-nextclaw --api-base https://marketplace-api.nextclaw.io
```

- 远端条目校验：

```bash
curl -sS https://marketplace-api.nextclaw.io/api/v1/skills/items/%40nextclaw%2Fclawhub-nextclaw
```

- 结果：
  - `ok: true`
  - `packageName: @nextclaw/clawhub-nextclaw`
  - `install.kind: marketplace`
  - `updatedAt: 2026-04-19T13:08:52.011Z`

### Marketplace 安装冒烟

- 非仓库目录安装：

```bash
tmp_dir=$(mktemp -d /tmp/nextclaw-marketplace-clawhub.XXXXXX)
nextclaw skills install @nextclaw/clawhub-nextclaw --api-base https://marketplace-api.nextclaw.io --workdir "$tmp_dir"
find "$tmp_dir/skills/clawhub-nextclaw" -maxdepth 3 -type f | sort
```

- 结果：
  - 安装成功
  - 落地文件为 `SKILL.md` 与 `marketplace.json`
  - 不再包含多余脚本

### 不适用项

- `build / lint / tsc` 不适用
  - 本次未触达项目主构建链路、类型链路或运行主链路代码
  - 变更范围仅为新增 marketplace skill 内容与其发布闭环
- `post-edit-maintainability-guard` 不适用
  - 执行命令：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths skills/clawhub-nextclaw/SKILL.md skills/clawhub-nextclaw/marketplace.json docs/logs/v0.16.77-clawhub-nextclaw-skill/README.md
```

  - 输出：`Maintainability check not applicable: no changed code-like files found.`

## 发布/部署方式

1. 本次 skill 已完成正式发布，当前线上包名为 `@nextclaw/clawhub-nextclaw`
2. 后续若只调整 skill 文案或元数据，执行：

```bash
nextclaw skills update skills/clawhub-nextclaw --meta skills/clawhub-nextclaw/marketplace.json --package-name @nextclaw/clawhub-nextclaw --api-base https://marketplace-api.nextclaw.io
```

3. 更新后继续执行：
  - 远端 `GET /api/v1/skills/items/%40nextclaw%2Fclawhub-nextclaw`
  - 非仓库目录 `nextclaw skills install @nextclaw/clawhub-nextclaw`

## 用户/产品视角的验收步骤

1. 在 NextClaw marketplace 搜索 `clawhub-nextclaw`
2. 安装该 skill
3. 阅读 skill 内容，能清楚理解：
  - `ClawHub` 是外部 skill 来源
  - `NextClaw marketplace` 是我们自己的 marketplace
  - 正确安装方式是显式传入 `--workdir <nextclaw-workspace> --dir skills`
4. 按 skill 提示执行：

```bash
clawhub --workdir <nextclaw-workspace> --dir skills search "<关键词>"
clawhub --workdir <nextclaw-workspace> --dir skills install <skill-slug>
```

5. 安装后在目标 NextClaw workspace 中确认：
  - `skills/<slug>/SKILL.md` 存在
  - `nextclaw skills info <slug> --workdir <nextclaw-workspace>` 能识别

## 可维护性总结汇总

- 是否已尽最大努力优化可维护性：是
- 是否优先遵循“删减优先、简化优先、代码更少更好”：是
  - 本次最重要的减债动作就是删除原先多包的一层本地脚本，直接复用上游 `clawhub` 的原生命令契约
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是
  - 最终交付只有 2 个文件：`SKILL.md` 与 `marketplace.json`
  - 没有额外引入 helper、wrapper、service 或脚本目录
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适：是
  - 该能力被严格限制在 `skills/clawhub-nextclaw/` 内，不侵入 NextClaw 核心 marketplace/CLI 安装器
  - 也没有假装把 ClawHub 变成官方 marketplace 源
- 目录结构与文件组织是否满足当前项目治理要求：是
- 独立可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：405 行
    - 删除：0 行
    - 净增：+405 行
  - 非测试代码增减报告：
    - 新增：405 行
    - 删除：0 行
    - 净增：+405 行
  - 长期目标对齐 / 可维护性推进：
    - 本次新增的是一个明确的用户能力，而且是“统一入口调度外部能力”这条主线上的增量，不是把外部生态硬塞进核心产品
    - 同时通过删除中间脚本层，把实现停在更简单、更可预测的边界上，朝“代码更少、边界更清晰、复用上游正式契约”推进了一小步
  - no maintainability findings
  - 可维护性总结：
    - 本次净增来自新增 marketplace skill 本身，属于新的用户可见能力，增长是必要且已压到最小
    - 最终没有把复杂度堆进 NextClaw 核心代码，而是保持为一个边界清晰的 skill 包
    - 后续 watchpoint 是：如未来需要展示更多 ClawHub 元信息，应优先继续复用上游命令契约，不要重新长出本地包装层

## NPM 包发布记录

- 不涉及 NPM 包发布
