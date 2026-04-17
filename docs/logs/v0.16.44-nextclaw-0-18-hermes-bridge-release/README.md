# v0.16.44-nextclaw-0-18-hermes-bridge-release

## 迭代完成说明

本次完成了 `nextclaw` 新一轮正式 NPM 发布，并把 Hermes ACP bridge 抽离后的新 runtime 交付面一起推上 registry。

- `nextclaw` 按用户要求完成 minor 升版，从 `0.17.12` 发布到 `0.18.0`。
- 新增并发布了独立包 `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`，把原先散落在通用 stdio runtime 内的 Hermes ACP bridge 能力收敛成可复用、可独立依赖的 runtime 包。
- 同步发布了与本次变更直接相关的包：
  - `@nextclaw/core@0.12.8`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`
- 因内部依赖链联动，本次发布链路还一并推送了自动进入批次的相关公开包，最终 registry 校验通过 `22/22` 个版本。

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm release:version
pnpm release:publish
npm view nextclaw version
npm view @nextclaw/nextclaw-hermes-acp-bridge version
npm view @nextclaw/nextclaw-ncp-runtime-stdio-client version
```

结果：

- `release:version` 成功生成版本号与 CHANGELOG。
- `release:publish` 成功完成发布、tag 与 registry 校验；最终结果为 `published 22/22 package versions`。
- 外部抽样确认：
  - `nextclaw@0.18.0`
  - `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`
  - `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`

## 发布 / 部署方式

本次已完成正式 NPM 发布，无需额外部署动作。

本次核心交付版本如下：

1. `nextclaw@0.18.0`
2. `@nextclaw/core@0.12.8`
3. `@nextclaw/nextclaw-hermes-acp-bridge@0.1.1`
4. `@nextclaw/nextclaw-ncp-runtime-stdio-client@0.1.2`

后续使用时，直接从 NPM 安装上述版本即可。

## 用户 / 产品视角的验收步骤

1. 在任意干净目录执行 `npm view nextclaw version`，确认输出 `0.18.0`。
2. 执行 `npm view @nextclaw/nextclaw-hermes-acp-bridge version`，确认新 bridge 包已可见。
3. 执行 `npm view @nextclaw/nextclaw-ncp-runtime-stdio-client version`，确认 stdio runtime 新版本已可见。
4. 若业务侧使用 `nextclaw` 主包，升级到 `0.18.0` 后执行一次真实安装或集成验证，确认 registry 可正常解析依赖。

## 可维护性总结汇总

### 长期目标对齐 / 可维护性推进

是。

这次发布不是单纯抬版本号，而是把 Hermes ACP bridge 从通用 stdio runtime 中独立出来后，真正收敛成对外可安装、可复用、可依赖的稳定交付面。这比继续把 Hermes 特例藏在通用 runtime 内，更符合 NextClaw 作为统一入口与能力编排层的长期方向。

### 可维护性复核结论

不适用。

原因：本次迭代记录聚焦 release 收尾与发布闭环，主要变更为版本编排、CHANGELOG、发布结果与 registry 验证；源代码层面的可维护性评估应分别归属到对应功能迭代，而不是在本次统一 release 记录里重复展开。

### 本次顺手减债

是。

- 把 `nextclaw 0.18.0` 与 Hermes ACP bridge 新包交付收敛到正式 registry。
- 避免“仓库代码已经切到新 runtime 边界，但外部用户仍拿不到对应包版本”的交付割裂。

### 代码增减报告

- 不适用：本次迭代记录的目标是发布闭环，而不是单独评价功能代码增量。

### 非测试代码增减报告

- 不适用：本次不单独对功能实现做可维护性统计，非测试代码变化已在对应功能迭代内处理。

### 删减优先 / 简化优先判断

是。

本次仍复用既有 `changesets + release scripts` 链路完成发布，没有再引入临时手工发版脚本或额外发布通道。

### 代码量 / 分支数 / 函数数 / 文件数 / 目录平铺度判断

总体可接受。

- 本次没有为了发版新增新的发布工具层。
- 文件变化主要集中在版本号、CHANGELOG 与发布记录，属于发布闭环的最小必要同步。

### 抽象与职责边界判断

更清晰。

- Hermes ACP bridge 现在有了独立公开包边界，不再只是通用 stdio runtime 内部的一块隐式特化逻辑。
- 发布链路仍由既有 release scripts 统一承接，没有新增第二套流程。

### 目录结构与文件组织判断

满足当前项目治理要求。

- 本次迭代记录按 `docs/logs/v<semver>-<slug>/README.md` 规范新增。
- 未新增额外发布脚本目录或临时发布资产目录。
