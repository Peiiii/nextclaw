# Skill Frontmatter 与现有项目注册修复设计

## 背景与目标

本次同时闭合 GitHub Issue #68 与 #69：

- Agent 的 Skill 目录必须按 YAML 语义读取 `SKILL.md` frontmatter，不能把 `>-`、`|` 等块标量指示符当成描述正文。
- 用户必须能通过一等 `nextclaw` CLI 把已经存在的非空目录注册为项目，不再绕过 CLI 调用 HTTP API。

两项改动都服务于统一、可编程的产品入口：Skill 的触发信息在不同消费入口保持一致，项目注册在 CLI、HTTP API 与 kernel 间复用同一业务语义。

## 现状证据与边界

### Skill frontmatter

`SkillsLoader.getSkillMetadata` 逐行拆分 `key: value`，因此 `description: >-` 被读成字面量 `>-`。同一份 frontmatter 在 kernel 的 installed-skill 投影中已经由 `yaml` 完整解析，当前存在两个不等价的语法 owner。

### 项目注册

`ProjectManager.addExistingProject(rootPath, name?)` 已负责路径规范化、目录校验、默认名称、恢复已移除项目和持久化；`POST /api/projects/existing` 也已复用该 owner。缺口只在 CLI 注册树和 command controller。

不改变 `projects create`：它仍只创建空目录或模板项目，不覆盖非空目录。不改变项目 store、HTTP 路由或会话绑定语义。

## 方案

### 1. 统一 YAML frontmatter 语法 owner

`SkillsLoader` 已是 Skill 文件发现、读取和目录生成的事实 owner，因此在 `@nextclaw/core` 的 agent feature 内新增纯函数 frontmatter 工具：识别文档开头的 `---` frontmatter、交给 `yaml` 解析，并同时提供原始顶层记录和现有强类型 Skill 字段投影。没有 frontmatter 时返回空结果；无效 YAML 抛出带 `SKILL.md` 上下文的错误。

`SkillsLoader` 把顶层字段规范化为现有 `Record<string, string>` 合同：字符串保持原值，其它 YAML 值使用 JSON 字符串表示。这既让折叠/字面块标量正确工作，也保持 `metadata: { ... }` 继续被现有 requirements/always 逻辑消费。目录扫描面对单个无效第三方 Skill 时保持原有容错，不让该 Skill 的元数据错误拖垮完整目录；需要结构化详情的严格入口仍可得到可观察的解析错误。

kernel 删除自己的 Skill frontmatter 实现，改为从 `@nextclaw/core` 公共入口消费；kernel 根入口继续重导出现有函数，避免 patch 版本破坏已经公开的导入路径。`yaml` 依赖随唯一语法 owner 从 kernel 移到 core。

这命中 `information-expert`、`single-complete-owner` 与 `equivalence-by-construction`：语法解析与字段投影都归 Skill runtime owner，kernel 只保留产品查询编排。不会新增 parser class、registry、shared 通用抽象或兼容 fallback。

### 2. 增加现有项目 CLI 入口

新增：

```bash
nextclaw projects register <directory> [--name <name>] [--json]
```

command controller 直接调用 `kernel.projectManager.addExistingProject(directory, name)`。未提供 `--name` 时由 kernel 从规范路径 basename 推导；重复注册返回已有记录；重新注册已移除路径恢复原项目 ID；默认 workspace 继续拒绝作为显式项目注册。JSON 输出复用 `projects create --json` 的项目对象形状，文本输出明确使用 `Registered project`。

候选中没有选择 `projects create --path` 自动分流，因为那会破坏 create 的“不覆盖非空目录”心智模型；没有选择 `add-existing`，因为 `register` 已清楚表达“只登记、不初始化或修改目录内容”，且更适合脚本和帮助文本。

## 用户链路与黄金验收

### A. Skill 发现

用户或第三方安装一个使用 YAML 折叠块标量描述的 Skill → NextClaw 扫描 global/workspace/project skills → Agent 系统提示中的 Skill 目录显示折叠后的完整描述 → Agent 可以依据真实触发条件选择 Skill。成功判定是目录包含完整描述且不出现字面量 `>-`；单行描述、inline `metadata` 和 always/requirements 行为保持不变。

### B. 注册已克隆项目

用户已有一个非空 Git 仓库 → 运行 `nextclaw projects register /path/to/repo --json` → CLI 校验并规范化目录，返回结构化项目对象 → `nextclaw projects list --json` 能看到同一项目，目录内容不被修改。可选 `--name` 覆盖显示名；目录不存在、不是目录、是默认 workspace 时返回明确失败。

## 验证矩阵

- core frontmatter owner：折叠块标量、字面块标量、CRLF、缺少 frontmatter、无效 YAML。
- core loader：真实临时 Skill 的 metadata 与 catalog prompt 展示完整折叠描述，同时保留 inline object metadata，并证明单个无效 Skill 不会阻断目录。
- CLI 注册：Commander 参数转发，controller 调用 kernel 的 path/name，JSON 与文本输出，默认 workspace 的明确错误。
- 回归：core/kernel/service/nextclaw 的定向测试与 `tsc`；CLI 命令参考同步测试；diff-only maintainability Review。

## 文档与交付

同步 `docs/USAGE.md`、随包 `packages/nextclaw/resources/USAGE.md`、中英文 CLI 命令全集和 `nextclaw-self-manage` Skill。用户可见行为添加 patch changeset。单批可闭环，`plan: not-required`。
