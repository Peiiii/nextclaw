# 聊天消息 Skill 引用持久化设计

## 背景

聊天中的 skill token 应能稳定打开对应 `SKILL.md`。当前消息只保存通用 `key`，而 `key` 实际承载了 `workspace:/absolute/path` 一类内部 ref；点击时还要借当前 session 的 skill catalog 再解析路径。消息已经持久化，却没有保存点击所需的完整事实，因此 session 切换、查询尚未同步或 workspace 变化时会出现无反馈点击。

这项改动增强 NextClaw 作为统一工作入口的连续性：历史消息自身应携带可复现的资源引用，而不是依赖当前页面碰巧加载到的临时状态。

## 现状依据

- `SkillsLoader` 已产生 `ref`、`name`、`path`、`source`、`scope` 完整记录。
- session skill API 已把这些字段完整返回前端。
- composer 使用 `ref` 选择运行时 skill，但 `ui_inline_tokens` 只持久化 `kind/key/label/rawText`。
- 消息渲染点击 skill 时从全局 query store 读取当前 session catalog，并按 `ref/name` 重新查找路径；未命中时静默返回。
- `requested_skill_refs` 是运行时选择合同，`ui_inline_tokens` 是消息展示合同，两者职责不同。

## 核心判断

第一处违约边界是消息 metadata 写入：上游已有完整 skill 事实，持久化层却丢掉了路径和来源。正确修复不是给点击事件增加更多猜测，而是让消息保存显式、可版本化的 skill 引用。

采用以下原则：

- `information-expert`：skill catalog 负责产生事实，消息发送边界负责快照所选事实。
- `types-tell-truth`：skill 使用专用 `ref/name/source/path` 字段，不再借通用 `key` 编码内部协议。
- `single-fact-owner`：新消息点击以消息内的 `path` 为主事实，session catalog 不再是主路径依赖。
- `boundary-only-defense`：旧格式只在 metadata reader 边界归一化，内部渲染只消费规范 view model。
- `predictable-behavior-first`：兼容失败必须显示错误，不允许按钮点击后静默无反应。

## 推荐方案

`ui_inline_tokens` 从无版本数组升级为显式版本对象：

```ts
type ChatInlineTokensMetadata = {
  schemaVersion: 2;
  items: Array<
    | {
        kind: "skill";
        ref: string;
        name: string;
        source: "builtin" | "global" | "project" | "workspace";
        path: string;
        label: string;
        rawText: string;
      }
    | {
        kind: "workspace_file" | "workspace_directory";
        key: string;
        label: string;
        rawText: string;
      }
  >;
};
```

`path` 保存发送时解析出的绝对 `SKILL.md` 路径。它不是“global path”；`global` 只表示来源分类。`ref` 继续作为运行时精确身份，但 UI 不解析其字符串结构。用户消息文本使用 `$<skill name>`，不再暴露 `$workspace:/...`。

## Owner 与数据流

```text
SkillsLoader
  -> session skill API (完整记录)
  -> composer 选择 ref
  -> 发送边界按 ref 快照 ref/name/source/path
  -> message.metadata.ui_inline_tokens v2
  -> metadata reader 规范化
  -> message renderer 直接打开 token.path
```

`requested_skill_refs` 保持不变，继续由运行时读取；renderer 不从它推导文件路径。panel app 与 workspace file/directory 保持各自现有合同。

## 目录组织

- 共享持久化类型继续由 `packages/nextclaw-shared/src/configs/chat-composer-token.config.ts` 所有。
- metadata 构造和兼容读取继续位于 chat input/session 既有 utils，不新增 resolver/service。
- 展示所需的显式 skill view model 由 `nextclaw-agent-chat-ui` 的既有 chat view-model 类型所有。
- 点击动作继续由 `ChatMessageListContainer` 连接现有 `ChatThreadManager`，不创建第二个 preview owner。

## 兼容与迁移

- 旧数组格式属于已持久化用户消息，保留一个明确的 v1 reader。
- v1 skill 的 `key` 只在 reader 边界转换为 `ref`，并标记为没有持久化路径。
- 用户点击 v1 skill 时，使用该消息所属 session 的只读 skill API 做一次精确 `ref` 查找；仅当名称唯一时才允许名称兼容。
- 查询失败、无 session、未命中或名称歧义时显示可本地化错误，不静默返回。
- v1 reader 的删除条件是历史 session journal 完成离线迁移；在此之前它只服务持久化数据，不成为新写入路径。

该兼容是纯读、用户触发的历史数据适配，不会加载、安装或修改 skill，也不会通过环境扫描掩盖发布缺陷。

## 验收标准

- 新消息 metadata 保存 schema v2 及显式 `ref/name/source/path`，不保存 skill `key`。
- 用户消息正文显示 `$skill-name`，不包含来源前缀或绝对路径。
- 新消息点击不依赖 session skill query，直接打开保存路径的 rendered preview。
- v1 消息按所属 session 查询并打开；错误和歧义均有可见反馈。
- builtin/global/project/workspace 四种来源原样保存。
- 同名 skill token 可按消息中出现顺序保持各自引用身份。
- 通过定向测试、相关 package `tsc`、ESLint、治理检查、可维护性检查和源码构建后的真实浏览器操作。

## 非目标

- 不把 skill 文件内容快照进消息；文件被删除或内容变化时仍以本地文件系统现状为准。
- 不改变运行时 skill 选择协议 `requested_skill_refs`。
- 不把 workspace 来源错误改名为 global，也不把所有 skill 复制到全局目录。
- 不重构整个 composer token 协议或文件预览系统。

## 后续实现顺序

1. 定义 v2 持久化合同和严格 v1/v2 reader。
2. 在发送边界快照完整 skill 记录，并让正文使用友好名称。
3. 扩展渲染 view model，直接消费显式路径。
4. 将 session catalog 降级为仅服务 v1 的用户触发只读兼容。
5. 完成定向、类型、治理、可维护性与真实页面验证。
