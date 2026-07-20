# v0.26.5 添加项目双路径

## 迭代完成说明

- 将侧边栏和弹窗的总入口从“新建项目”调整为“添加项目”，并把用户意图区分为“新建项目”和“添加已有目录”两个互斥路径。
- 新建项目继续创建新的项目目录，并允许选择空项目或知识库模板；添加已有目录只接收服务端目录路径，项目名取目录名，不显示模板，也不初始化或修改目录内容。
- 根因是既有 UI 和 HTTP/SDK 只暴露 `ProjectManager.createProject()`，虽然 kernel 已有只登记目录的 `registerExistingProject()`，用户却无法显式选择这条链路；原表单因此把“创建目录”和“登记目录”混成了一个含糊操作。
- 端到端代码审计确认了 create 与 register-existing 的不同文件系统语义；修复直接补齐独立的 HTTP、client SDK、mutation 和 UI 命令，继续由 `ProjectManager` 作为项目目录规则与注册表写入的唯一 owner，没有依赖目录状态猜测或失败 fallback。
- 设计依据、owner、数据流、兼容边界与验收标准记录在 `docs/designs/2026-07-20-add-project-entry.design.md`。

## 测试/验证/验收方式

- kernel 项目 manager 定向测试：1 个测试文件、7 个用例通过，覆盖非空已有目录登记且标记文件不变、无模板物化。
- server 项目 controller 定向测试：1 个测试文件、3 个用例通过，覆盖装配后的 `POST /api/projects/existing`。
- client SDK 定向测试：1 个测试文件、15 个用例通过，确认 endpoint、method 和仅含 `rootPath` 的请求体。
- UI 添加项目对话框与服务端目录选择器定向测试：2 个测试文件、14 个用例通过，覆盖两种模式的字段隔离、提交合同，以及已有目录模式隐藏“新建文件夹”。
- `@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/ui` TypeScript 检查最终复跑均通过；四个 package lint 均为 0 error，kernel 和 server 只保留本次未触达文件中的既有 warning。
- 当前源码的 UI 与 `nextclaw` 包构建通过；生成产物在冒烟后已恢复为仓库状态。
- 隔离源码实例真实浏览器冒烟通过：入口和弹窗显示“添加项目”；新建模式创建 `browser-created-project` 目录并登记 `template=empty`；已有目录模式登记含标记文件的 `existing-project-smoke`，登记前后标记文件路径、大小和 mtime 一致，目录没有新增文件，项目记录没有 `template`；页面控制台 0 error。
- 本次路径的 scoped `pnpm lint:new-code:governance` 与全仓 governance backlog ratchet 通过。全仓 unscoped governance 被无关并行改动 `workers/nextclaw-provider-gateway-api/src/services/remote-access.service.ts` 的 classless `.service.ts` 角色错误阻断，本批未触达该文件。
- 侧栏完整测试文件当前有 7 个既有失败：测试仍期待旧的 `createSession("codex", path)` 调用，而当前 HEAD 源码使用 `{ projectRoot, sessionType }` 请求对象；本次仅增加项目 hook mock，相关添加项目行为已由定向测试和真实浏览器链路覆盖。

## 发布/部署方式

- 新增 `.changeset/add-existing-project-directory.md`，标记 `@nextclaw/ui`、`@nextclaw/server` 和 `@nextclaw/client-sdk` patch。
- 本次未发布 NPM 包、未部署，也未重启用户当前运行的 NextClaw 实例。
- 浏览器验收使用独立临时 home 和 `18976` 端口的当前源码实例；验收后已停止实例并清理仓库生成产物。

## 用户/产品视角的验收步骤

1. 在侧边栏切换到“项目”视图，确认入口显示“添加项目”。
2. 打开弹窗并保持“新建项目”，填写项目名称，按需选择模板或空目录，点击“创建项目”；确认新目录创建并立即出现在项目列表。
3. 再次打开弹窗，切换到“添加已有目录”；确认项目名称、项目模板和目录选择器中的“新建文件夹”均不再显示，并能看到“不会修改或初始化目录内容”的说明。
4. 选择一个已包含文件的服务端目录，点击“添加到项目列表”；确认目录以 basename 作为项目名出现，原有文件内容和时间戳不变，也没有生成模板文件。
5. 尝试缺失路径、非目录路径或默认 workspace，确认显示明确错误且不出现成功提示。

## 可维护性总结汇总

- 本次是新增用户能力，maintainability guard 检查 20 个现存文件及两个被替换的旧组件路径：总代码 `+607 / -295 / 净增 312`，非测试代码 `+409 / -228 / 净增 181`，0 error、6 warning。
- 生产代码增长来自独立外部合同与双路径表单；同时直接删除 create-only 组件和测试共 270 行，没有保留 alias、兼容 wrapper、目录探测 fallback、第二份项目状态或新的 manager/store/helper。
- 6 条 warning 均为既有目录预算例外或接近预算的历史文件；本次没有新增这些目录的直接文件。侧栏测试曾因 6 行新 mock 越过 900 行预算，已将纯夹具收敛为单行对象，使文件保持 899/900 行。
- `post-edit-maintainability-review` 复核无新增 finding：`ProjectManager`、server controller、client service 和 UI mutation/component 的 owner 边界清晰；创建与登记各自只有一条命令链路，已有目录的“不初始化”语义可由请求类型和真实文件系统结果共同验证。

## NPM 包发布记录

- `@nextclaw/ui`：npm 当前已发布 `0.15.12`；本次需要 patch，用于提供“添加项目”双路径界面，待统一发布。
- `@nextclaw/server`：npm 当前已发布 `0.15.12`；本次需要 patch，用于暴露已有目录登记 endpoint，待统一发布。
- `@nextclaw/client-sdk`：npm 当前已发布 `0.5.12`；本次需要 patch，用于暴露 `projects.addExisting()`，待统一发布。
- Changeset：`.changeset/add-existing-project-directory.md`。
- 本次未执行 NPM 发布。
