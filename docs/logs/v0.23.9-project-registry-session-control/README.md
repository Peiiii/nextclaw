# v0.23.9 项目注册表与会话控制

## 迭代完成说明

- 新增 kernel `ProjectManager` / `ProjectStore`，使用 `${NEXTCLAW_HOME}/projects/projects.json` 原子持久化独立项目列表；项目不再依赖会话投影，因此可以没有任何会话。
- 新增 `empty` 与 `knowledge-base` 两个内置模板。知识库模板生成 `README.md`、`sources/` 与 `notes/`，非空目标目录不会被覆盖。
- `SessionManager` 统一拥有会话名称、偏好、session type、read timestamp 与项目绑定更新；server controller 删除平行 metadata 拼装逻辑。
- 默认 workspace 继续只是有效 workdir 和目录表单起点；绑定默认 workspace 会清除显式 `project_root`，不会把默认 workspace 登记成项目。
- 新增 `projects list/templates/create` 与 `sessions rename/set-project/clear-project` CLI，并新增 `projects_list`、`projects_create`、`sessions_update` AI tools。
- 新增 `/api/projects`、client SDK projects service；project-first 侧边栏、折叠会话切换器与欢迎页以项目注册表为基线，零会话项目可见并可直接创建会话。
- project-first 侧边栏新增“新建项目”入口，界面可填写名称、选择空项目/知识库模板和可选目标目录；成功后立即刷新项目列表。
- 新建项目的目标目录接入共享服务端目录选择器；选择器按 Windows 文件夹选择器主交互模型重构为顶部导航/地址/搜索、左侧常用位置、名称/类型目录列表和底部确认区，支持单击选择、双击或 Enter 进入、方向键选择、历史导航、刷新和新建文件夹。新增文件夹通过专用 server/client API 写入后留在当前层并选中新目录，项目创建与会话目录设置共享同一体验。
- 服务端目录浏览结果新增平台感知的常用位置：macOS 额外返回 iCloud 云盘、应用程序、磁盘与卷；Windows 优先采用实际存在的 OneDrive 桌面/文稿重定向；Linux 优先遵循 XDG `user-dirs.dirs`。UI 将收藏入口与系统“位置”分组展示，左侧单击直接跳转。
- 修复跨平台路径解析根因：browse 曾自行用 `startsWith("/")` 判断绝对路径，绕开已经存在的 server path resolver，导致 Windows `C:\\...` 首次浏览被误判为相对路径，UNC 也无法进入。本次删除重复判断，browse/read/content/create-directory 统一经过 `resolveServerPath`，由运行平台的 `node:path.isAbsolute` 处理 POSIX、盘符和 UNC；home 展开同时支持 `~`、`~/...` 与 Windows `~\\...`。
- 工具栏固定显示“单击选择，双击进入”，不再把交互提示放在会被项目/会话业务说明替换的底部 hint 插槽。根因是原默认提示与调用方业务提示共用同一可替换字段，两个真实入口都会覆盖它；本次将交互规则与业务说明拆到各自稳定 owner，而不是只修改某个入口文案。
- 修复路径选择器初始化竞态与路径表达漂移：显式会话 workdir 不再被旧的 home 浏览结果覆盖，`~/.nextclaw/workspace` 经服务端解析后统一显示为真实绝对路径，地址栏和待确认目录始终对应同一个位置。
- 修复共享选择器调用合同漂移：会话“设置项目目录”此前把默认 workspace 折叠进 `currentPath`，虽然浏览起点正确，却不会生成工作区快捷入口。现在所有入口都复用唯一 `ServerPathPickerDialog`，并分别传递当前浏览路径与 `defaultWorkspacePath`；左侧名称同步明确为“NextClaw 工作区”。
- 将“用户指定 Windows 或成熟产品作为体验基准时，必须对齐完整交互模型并以真实页面视觉/任务链路验收”补入 `frontend-interaction-quality` skill，避免再次把能力清单误判成体验对齐。
- 设计依据见 `docs/designs/2026-07-15-project-registry-and-session-control.design.md`。

## 测试/验证/验收方式

- TypeScript：core、kernel、server、client-sdk、service、nextclaw、ui 七个触达 package 的 `tsc` 全部通过。
- package lint：七个触达 package 均为 0 error；本次新增的 `SessionManager.patchSessionSettings` statement warning 已通过 owner 内职责拆分消除。其余输出为未由本次引入的历史 warning。
- 定向测试：kernel `29`、server `35`、client SDK `12`、UI `39`，共 `115` 条测试通过，覆盖项目 owner、API、CLI/tool 适配、零会话投影、创建 dialog、路径选择器交互、重新打开时的状态重置与初始化竞态。
- 真实源码 CLI 冒烟使用隔离目录 `/tmp/nextclaw-project-final.uMySYR`：
  - 创建并列出 `EmptyProject` 与 `KnowledgeTwo`，二者在零会话状态下均从注册表读回；
  - 知识库项目真实生成 `README.md`、`sources/`、`notes/`；
  - 创建真实 journal 会话后，`sessions rename`、`set-project`、`clear-project` 均从真实 summary 读回预期结果；
  - `set-project` 指向默认 workspace 时，summary 保留有效 `workingDir` 且无显式 `project_root`。
- UI 生产构建通过；组件/投影测试覆盖零会话项目、目录表单默认 workdir、单击选择、双击/Enter 进入、方向键选择、地址跳转、历史和新建文件夹后选中。
- 本次交互与跨平台补强的本机定向测试通过：server path controller `18` 条通过、Windows/Linux 平台专项 `2` 条按当前 macOS 环境跳过，UI path picker `11` 条通过；覆盖固定提示、macOS 常用位置、左侧单击跳转、Windows home 分隔符规范化与标准用户目录发现。
- `desktop-validate` 已在既有 Ubuntu、macOS、Windows runner 中加入同一 server path controller 测试门禁；当前未提交/推送，因此远端 Windows/Linux runner 尚未执行，不能把本机模拟结果表述为真实 Windows/Linux 运行通过。
- 使用最新源码在 `127.0.0.1:18973` 的隔离实例补充真实页面验收：Mac 常用位置完整显示 NextClaw 工作区、主目录、桌面、文稿、下载、iCloud 云盘、应用程序以及“位置”下的磁盘与卷、文件系统；单击“下载”后面包屑和目标路径立即跳转到 `/Users/peiwang/Downloads`；单击 `Github` 仅选中 `/Users/peiwang/Downloads/Github`，双击进入该目录，随后选择 `ECM-master` 并按 Enter 成功进入。工具栏提示全程可见，截图确认 1024px 弹窗内无挤压或横向溢出；隔离实例已停止且临时 home 已删除，未替换或重启用户正在运行的 NextClaw 实例。
- 使用隔离 `NEXTCLAW_HOME=/var/folders/gp/ls0ngf8d1qn97_g1t48670zc0000gn/T/nextclaw-source-runtime-PJ7FEL` 的最新源码运行实例在 `127.0.0.1:18973` 完成真实页面复验：打开“新建项目 -> 浏览”，确认顶部地址/搜索、左侧常用位置、目录主列表和底部选择区；单击 `knowledge` 只改变选中路径且后退仍禁用，双击后进入该目录并启用后退；通过可编辑地址进入隔离目录，新建 `picker-final-smoke` 后留在父目录并高亮新目录。1280px 视口下选择器为 1024px，弹窗 `scrollWidth === clientWidth`，页面无横向溢出。测试目录已删除，隔离实例已停止，未替换或重启用户正在运行的 NextClaw 实例。
- 使用最新源码在 `127.0.0.1:18974` 的独立实例完成跨平台补强后的最终冒烟：真实 `/api/server-paths/browse` 返回规范 current/home/breadcrumbs，以及当前 macOS 实际存在的桌面、文稿、下载、iCloud 云盘、应用程序、磁盘与卷；从“新建项目 -> 浏览”进入选择器，固定交互提示、平台位置分组、地址路径和目录列表同时可见。页面、进程与临时 home 均已清理，未触达用户实例。
- 使用最新源码在 `127.0.0.1:18975` 的隔离实例从用户点名的真实入口“会话 -> 更多操作 -> 设置项目目录”复验：同一共享选择器显示“NextClaw 工作区”快捷入口及 `/Users/peiwang/.nextclaw/workspace`，固定提示“单击选择，双击进入”、macOS 常用位置与“新建文件夹”同时可见；点击工作区入口后地址、面包屑和目录列表保持一致。验收后点击“取消”，未写入会话项目目录，也未替换或重启用户正在运行的 NextClaw 实例。
- `post-edit-maintainability-guard` 检查 82 个本次代码文件：0 error、12 个预算 warning；全工作区 `pnpm lint:new-code:governance` 与 governance backlog ratchet 均通过。治理检查另提示一个既有的 `shared/lib/api/utils` 平铺目录 warning，不阻塞本轮。
- `docs/USAGE.md` 已通过 `packages/nextclaw/scripts/sync-usage-resource.mjs` 同步到 npm runtime resource。

## 发布/部署方式

- 本轮未执行 commit、push、部署或发布；用户未要求这些外部状态变更。
- 不涉及数据库 migration、远端服务部署或线上 API 冒烟。
- 已添加用户可见 changeset，后续统一 NPM 发布时由现有 Changesets 流程消费。

## 用户/产品视角的验收步骤

1. 运行 `nextclaw projects create knowledge --template knowledge-base --json`，确认返回项目路径。
2. 运行 `nextclaw projects list --json`，确认没有会话时仍能看到该项目。
3. 切换聊天侧边栏为 project-first，点击“新建项目”，打开目录选择器；确认顶部导航/地址/搜索、左侧常用位置、目录名称/类型列表、固定交互提示和底部目标目录同时可见。Mac 上确认 iCloud/应用程序/磁盘与卷按存在性显示；Windows 验证盘符路径、UNC、OneDrive 重定向与 `~\\...`；Linux 验证 XDG 重定向目录。左侧位置单击应直接跳转，右侧目录单击应只选中，双击或 Enter 才进入。可新建并选中文件夹，再创建空项目或知识库项目，确认项目立即以数量 `0` 显示。
4. 运行 `nextclaw sessions rename <session-id> "New name" --json`，确认 UI 会话名读取一致。
5. 运行 `nextclaw sessions set-project <session-id> <directory> --json`，确认 workingDir 与项目列表一致；再运行 `clear-project` 确认回到默认 workdir。
6. 对无显式项目的会话打开“设置项目目录”，确认输入值与浏览起点是该会话的有效 workdir。

## 可维护性总结汇总

- 本次是新增用户能力，生产代码增长用于引入独立项目实体、单一 kernel owner、CLI/tool/API 适配和 UI 投影，不适用非功能改动的净增零门槛。
- 已删除 server 下两套 session preference/project-root 写入 utils，把所有持久化不变量收回 kernel；CLI、HTTP 与 AI tool 不复制业务规则。
- 路径选择器的导航、选择、搜索和新建文件夹状态只存在于一次 dialog 打开周期内；关闭后显式卸载，服务端规范路径在 render 中派生，不使用 React effect 修补本地状态，也没有新增平行 UI store。
- 平台绝对路径解析统一收敛到 `resolveServerPath`，删除 browse 的重复判断；常用位置发现由独立的纯 `server-path-locations.utils.ts` 负责，UI 只处理标签、图标、分组和导航反馈。远程访问时展示的是服务端机器而不是浏览器机器的真实位置，自动 browse/refetch 仍保持纯读。
- 代码增减报告：最终守卫快照中 82 个代码文件共 `+3846 / -553`，净增 `3293` 行。
- 非测试代码增减报告：`+2682 / -464`，净增 `2218` 行；这是新增用户能力，符合新增能力豁免，不适用非功能改动净增 `<= 0` 门槛。
- `post-edit-maintainability-review` 结论：项目注册、模板创建与路径不变量集中在 `ProjectManager`，会话 metadata 写入集中在 `SessionManager`，HTTP/CLI/tool 仅做适配；已删除 server 的两套平行写入 utils。选择器按导航、位置、目录列表、新建文件夹和底部确认区拆分，dialog session 是唯一交互状态 owner，没有新增 fallback、平行 store、React effect 或业务编排 hook。12 个 warning 均为既有目录/文件预算或测试增长提示，本轮 0 error，不构成阻塞。

## NPM 包发布记录

- 本轮未执行 NPM 发布。
- 待统一发布：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/client-sdk`、`@nextclaw/service`、`@nextclaw/ui`、`nextclaw`，均由 `.changeset/project-registry-session-control.md` 记录 patch 变更。
