# NextClaw 0.59.0 正式发布

## 迭代完成说明

- 状态：进行中。用户授权发布正式版，采用常规产品范围 `target=product`，不含桌面安装包。
- 源基线：`c5449fc070d0ee7c7a4e6a8ad5736b58e0b5927e`；发布冻结提交：`045b319053ec366434cd14ced8371fd5f37a66f6`。
- 根因：此前 exact-commit prepare 因 Changesets 仍处于 beta pre 模式失败；父 workflow 在读取 stable 计划前又要求当前包版本已为 stable，阻断 beta 晋升。
- 证据：prepare run `37197760516` 的失败日志、退出 pre 后的真实 Changesets 计划（`0.59.0-beta.2 -> 0.59.0`）、执行 workflow 原始身份脚本的定向测试。
- 修正：使用 Changesets 原生 `pre exit`；身份 owner 允许正式版本计划承接 prerelease 源版本，仍拒绝活跃 pre 模式，并保持已发布 Desktop Draft 的恢复优先级。
- 主工作区的既存想法与设计草稿完全排除；本任务改动仅在隔离 worktree 中完成。

## 测试/验证/验收方式

- `actionlint .github/workflows/release.yml` 通过。
- `node --test scripts/release/release-action-environment.test.mjs scripts/release/release-stable.test.mjs`：41 项通过。
- 正式 dry-run：`0.58.0 -> 0.59.0`；34 个版本变更、28 个 NPM 发布包、42 个验证依赖包（14 个仅构建支持包）。
- 新代码治理与 backlog ratchet 通过。
- Prepare 随后暴露 kernel 的 39 个 lint 错误，集中在类型导入和测试字符串转义。已修复 4 个相关文件，并把已有 NodePlatform 深层导入改为 feature 公共入口；kernel 全 lint 错误清零（16 个既有警告）、依赖闭包构建、kernel `tsc` 和日志维护 5 项测试通过。
- 双语文档 VitePress 构建及 i18n 检查通过（170 对镜像页面）。
- Registry、Runtime manifest、真实旧版本升级：由父 workflow 闭合，尚待终态证据。

## 发布/部署方式

- `release.yml target=product expected_head=045b319053ec366434cd14ced8371fd5f37a66f6`，仅 dispatch 一次。
- Prepare：[37607717476](https://github.com/Peiiii/nextclaw/actions/runs/37607717476)。
- Parent：[37607749843](https://github.com/Peiiii/nextclaw/actions/runs/37607749843)。
- 首轮 prepare 在任何 NPM 上传前因 lint 失败，父运行取消；registry 确认 `latest=0.58.0`。修复后冻结新 source 并从原 owning entry 恢复，不重发已发布身份。
- 内容补充在 dispatch 后进行，不阻塞 NPM/Runtime；双语笔记与 JSON 正在准备。官网和 X 仍为 `CONTENT_PENDING`。
- 干预：发布前退出 beta 模式并修复晋升判定（准备阶段，不计 owner 运行后的干预）；owner 运行后因 kernel lint 根因修复并更换 source，计 1 次，最终次数待终态核定。

## 用户/产品视角的验收步骤

1. 安装 `nextclaw@latest` 并确认版本 `0.59.0`。
2. 打开会话列表：置顶会话跨刷新保留，定时任务会话可在独立视图查看。
3. 从上一 stable 检查、下载、应用 Runtime 更新并核对新进程版本；此步骤由发布验证 owner 在隔离环境执行。

## 可维护性总结汇总

- 沿用 Changesets、既有发布身份解析和父 workflow，不增加第二套发布入口。
- 自动维护性检查：无 errors/warnings；修改仅涉及身份判断、回归测试与发布元信息，不改变 package/owner 边界。
- kernel 修复的检查为 0 errors、1 warning：既有 kernel app 文件接近预算（327/400 行）。主观复核确认只新增命名类型导入，未增加职责、抽象或平行 owner，不为这次发布扩大拆分范围。
- planned-path preflight 用于双语更新笔记、结构化 JSON 和本记录。

## NPM 包发布记录

需要发布：把既有 beta 能力晋升到 stable。精确包/version 状态从 prepared artifact 与父 workflow 的最终摘要补齐；当前预计 28 个 public package，包含 `nextclaw@0.59.0`，尚未声明发布完成。
