# 项目注册表与会话控制设计

## 背景

NextClaw 目前把“项目”理解成会话 `metadata.project_root` 的 UI 投影：只有至少一个会话绑定目录后，侧边栏和欢迎页才会出现对应项目。这让项目无法先于会话存在，也无法通过模板创建一个空项目或知识库项目。

同时，设置会话项目目录和修改会话名称虽然已有 UI/API 写入能力，但没有成为 kernel 的显式业务命令，也没有稳定的 CLI 与 AI tool 入口。无项目会话打开“设置项目目录”表单时，目录浏览器从服务端 home 开始，而不是从该会话已经解析出的默认 workdir 开始。项目创建也必须是完整产品能力：UI 面向用户，CLI/tool 面向自动化与 AI，不能用 CLI 入口代替界面入口。

## 现状依据

- `SessionManager` 与 session journal 持久化会话；`metadata.project_root` 是会话显式项目绑定，`metadata.label` 是会话显示名称。
- `SessionWorkingDirResolver` 按 `explicit project root ?? resolved agent workspace` 产生会话 `workingDir`。
- server 的 `PUT /api/ncp/sessions/:sessionId` 当前在 controller 内拼装 label、偏好、session type、UI read timestamp 与 project root metadata，产品规则没有完全回到 kernel owner。
- chat 侧边栏的 `groupSessionsByProject` 和欢迎页的 `buildChatWelcomeProjectOptions` 都只遍历 session summaries，因此没有会话的项目一定不可见。
- `ChatSessionProjectDialog` 在没有 `currentProjectRoot` 时向 server path browser 传 `null`；server path browser 的缺省目录是服务端 home。
- AI 当前只有会话 list/history/spawn/request/search tools，没有修改会话名称、设置项目目录、创建或列出项目的 tool。
- CLI 当前没有 `projects` 与 `sessions` 管理命令。
- 既有 workspace 合同要求：默认 workspace 是配置事实，不是显式项目；等于默认 workspace 的路径不能重新固化成 session `project_root` 或普通项目条目。

## 核心判断

项目与会话是两个独立但有关联的领域事实：

- 项目注册表回答“用户维护了哪些项目”，项目可以没有任何会话。
- 会话 metadata 回答“这个会话当前绑定哪个项目目录”，仍是运行期 workingDir、项目 skills 和上下文解析的重要输入。
- 会话绑定真实目录时，kernel 应确保该目录已进入项目注册表；不能让 server、CLI、AI tool 各自维护一套登记逻辑。
- 默认 workspace 只作为会话无显式项目时的有效 workdir 和表单起点，不自动成为注册项目，也不写回 `project_root`。

该边界落实 `single-domain-owner`、`product-kernel-ownership`、`defaults-have-owners`、`cqs-pure-read`：项目状态和模板创建归 kernel 项目 owner，session 状态归 session owner，CLI/server/tool 只负责输入输出适配；项目列表读取保持纯读。

## 方案空间与推荐

### 止血方案：继续从 session metadata 推导项目

可以增加一个“空项目占位 session”，让现有 UI 自动出现项目。它会污染会话列表、混淆项目与会话生命周期，也无法形成真实项目模板与 CLI 合同，因此不采用。

### 结构性方案：kernel 项目注册表 + session 绑定

新增持久化 `ProjectManager` / `ProjectStore`，项目以规范化绝对目录作为唯一键；项目创建、已有目录登记、模板列举都走同一个 manager。`SessionManager` 在创建或修改显式项目绑定时调用项目 owner，并继续把规范路径写入 session metadata。server、CLI、AI tools 与 UI 项目列表都消费这条主链路。

这是本轮推荐并落地的方案。它用最少的新概念解决“项目可独立存在”，同时保留既有 session/project context 合同。

### 长期演进：项目 ID、远程项目与多根项目

未来若出现目录移动、远程知识库、一个项目多 workspace 等真实变化压力，可在项目实体上增加稳定 ID 和资源描述。但当前所有执行、skills 与文件浏览语义仍以本地目录为根，提前引入 ID 映射、provider 或 registry 插件只会增加同步成本，本轮不做。

## 推荐方案

### 1. 项目实体与持久化

项目记录至少包含：

- `name`：用户可见名称。
- `rootPath`：规范化绝对目录，也是当前唯一键。
- `template`：创建时使用的模板 ID；登记已有目录时为空。
- `createdAt` / `updatedAt`：排序和审计时间。

项目注册表写入 `${NEXTCLAW_HOME}/projects/projects.json`，使用临时文件加 rename 的原子替换。缺失文件表示空列表；损坏或未知结构必须显式报错，不能静默当成空列表覆盖用户数据。

项目列表 `listProjects()` 是纯读，不因 UI 加载、轮询或 refetch 自动扫描目录、导入会话或写文件。历史 session 项目的兼容导入只在 kernel 启动阶段显式执行一次；不存在或无效的历史目录保留在 session metadata 中，但不伪造注册成功，并输出可观察警告。

### 2. 项目创建与模板

首批内置模板：

- `empty`：只创建项目根目录，不写任何内容。
- `knowledge-base`：创建项目根目录、`sources/`、`notes/` 和简短 `README.md`。

若调用方未提供目标路径，使用默认 agent workspace 作为父目录，并以项目名作为子目录名。项目名不能包含路径分隔符。目标目录不存在时创建；目标目录已存在且非空时创建命令失败，避免模板覆盖已有文件。绑定一个已有目录是另一条明确语义：验证目录存在后登记，不偷偷套用模板。

默认 workspace 是保留的默认 workdir，不作为普通项目创建或登记，避免重新引入“默认 workspace = 显式项目”的历史错误。

### 3. 会话名称与项目绑定

`SessionManager` 新增意图级 session settings 更新能力，统一处理现有 `label`、preferred model/thinking、session type、UI read timestamp 和 `projectRoot` patch。server controller 删除自己的 metadata 业务拼装，只保留 HTTP 输入校验与错误映射。

修改项目绑定时：

1. 规范化并验证目录。
2. 若目录等于默认 workspace，按“无显式项目”处理。
3. 真实项目目录通过 `ProjectManager` 登记。
4. `SessionManager` 原子更新该 session 的 `metadata.project_root`。
5. 清除绑定时删除 legacy `project_root` / `projectRoot` 字段。

修改会话名称继续使用唯一 `metadata.label`，不新增 `name`、`title` 等平行字段。

### 4. CLI 合同

新增以下命令：

```text
nextclaw projects list [--json]
nextclaw projects templates [--json]
nextclaw projects create <name> [--path <directory>] [--template empty|knowledge-base] [--json]

nextclaw sessions rename <session-id> <label> [--json]
nextclaw sessions set-project <session-id> <directory> [--json]
nextclaw sessions clear-project <session-id> [--json]
```

CLI 是 kernel owner 的薄适配层，主要为 AI、脚本和高级用户提供稳定操作合同，但不替代 UI。普通项目/会话管理直接修改同一个本地持久化事实，不要求启动或重启常驻服务；若服务已运行，后续 API 读取会看到新值。

### 5. AI tool 合同

新增：

- `projects_list`：纯读项目列表与可用模板。
- `projects_create`：按 `name`、可选 `path` 与 `template` 创建项目。
- `sessions_update`：按 `sessionKey` 更新可选 `label` 和/或 `projectRoot`。

tool schema 只描述稳定参数，不嵌入 CLI 操作流程。tool 直接调用 kernel manager，不通过 shell 绕行，也不复制路径验证或 metadata 写入逻辑。

### 6. API 与 UI 投影

新增项目 API 和 client SDK service：

- `GET /api/projects`：返回注册项目、模板与总数，纯读。
- `POST /api/projects`：按同一 kernel 合同创建项目。
- `POST /api/server-paths/directory`：在当前服务端目录下安全创建单层文件夹，供共享目录选择器使用。

project-first 侧边栏与欢迎页项目选择器改为“项目注册表为基线，session summaries 只补充会话数量和最近活动”。因此零会话项目仍会显示，并可直接在其下新建会话。

项目视图标题区提供“新建项目”入口，打开名称、模板和可选目标目录表单。目标目录留空时沿用 kernel 的默认 workdir/项目名规则；提交只调用 `POST /api/projects`，成功后失效并刷新唯一 `projects` query，项目立即以零会话状态出现在列表。UI 不维护第二份项目 store，也不复制模板物化规则。

目标目录不采用只允许手填的简化输入，也不调用浏览器所在机器的原生文件选择窗口。NextClaw 可能远程访问另一台服务端，浏览器本机目录与项目实际运行目录并不是同一个文件系统；因此复用并完善共享的服务端目录选择器。

选择器按 Windows 文件夹选择器的主交互模型组织，而不是把一组能力按钮平铺在表单里：顶部是后退、前进、上一级、可编辑的面包屑地址栏、刷新与当前目录搜索；左侧是 NextClaw 工作区、主目录和服务端文件系统等常用位置；中间是带名称/类型列和明确选中态的目录主列表；底部独立显示待确认文件夹与取消/确认操作。“正在浏览的目录”和“准备确认的目录”是两个状态：单击目录行只选中，双击或按 Enter 才进入，方向键在目录行间移动选择。工具栏固定显示“单击选择，双击进入”，不让项目表单自己的说明文案覆盖核心交互提示。地址栏支持面包屑跳转、显式编辑与回车打开；服务端通过唯一 `resolveServerPath` owner 按运行平台解析 `~`、POSIX 根路径、Windows 盘符和 UNC 网络路径，地址栏和待确认值统一显示规范路径，旧 browse response 不能覆盖本次显式请求。

常用位置由服务端按实际平台与目录存在性返回，避免 Web UI 猜测浏览器机器的文件系统。所有平台提供 NextClaw 工作区与 home；桌面、文稿和下载按平台事实解析：macOS 使用标准用户目录并在存在时增加 iCloud 云盘、应用程序、磁盘与卷，Windows 优先采用 OneDrive 重定向目录再回到用户目录，Linux 优先读取 XDG `user-dirs.dirs` 再回到英文默认目录。左侧位置采用文件浏览器惯例，单击即跳转；右侧主列表继续保留单击选择、双击或 Enter 进入，避免把两种空间角色混成同一交互。

每次打开 dialog 都创建一段独立的本地选择会话，导航历史、选中项、搜索词和新建文件夹输入只在该打开周期内存在，关闭时随会话组件显式卸载。服务端返回的规范路径由“当前浏览请求 + browse result”直接派生，不通过 React effect 镜像或修补本地状态；这样打开/关闭是唯一重置边界，后台 query 刷新不会接管焦点、选择或导航历史。

新建文件夹通过 `POST /api/server-paths/directory` 写入当前服务端目录，名称只允许单个路径段，拒绝 `..` 与路径分隔符，避免逃逸已选父目录；创建成功后留在当前层并选中新目录，用户可直接确认或双击进入。项目创建、会话“设置项目目录”、项目徽标和新会话工作目录入口都复用唯一 `ServerPathPickerDialog` 与同一 API，不维护两套文件浏览体验。调用合同明确区分 `currentPath` 与 `defaultWorkspacePath`：前者只决定本次浏览起点，后者稳定提供“NextClaw 工作区”快捷入口；任何调用方都不能再把默认工作区折叠进当前路径而导致入口间能力漂移。

这里对齐的是 Windows 的空间层级、选择/进入模型、导航习惯、键盘行为与反馈，而不是伪装成浏览器所在操作系统的原生窗口。完整“此电脑”盘符树、系统收藏夹、网络驱动器挂载和系统权限弹窗属于服务端操作系统或部署环境，不由 Web UI 伪造；当前盘符根目录由面包屑与“文件系统”入口呈现，其他盘符和 UNC 共享可通过地址栏输入规范绝对路径。服务端返回的平台、根目录、home、实际存在的常用目录和可读目录才是事实来源。验收不能只检查按钮存在，必须在真实页面完成左侧位置单击跳转、右侧目录单击选择、双击/Enter 进入、地址跳转、历史返回、搜索和新建文件夹，并检查最终视觉层级与交互提示。

现有项目目录表单不新增平行状态。对已有显式项目，起点仍是 `projectRoot`；对无显式项目的已创建会话，起点改为 summary 中已经解析出的 `workingDir`；新会话欢迎页继续使用配置解析出的默认 workspace。这样只优化浏览起点，不把默认 workdir 持久化为项目绑定。

## Owner 与数据流

```text
CLI / HTTP / AI tool
        |
        v
ProjectManager ----------------------> ProjectStore
  create/register/list/templates        projects/projects.json
        |
        | canonical rootPath
        v
SessionManager
  patchSessionSettings
        |
        v
session journal metadata.project_root / metadata.label
        |
        +--> SessionWorkingDirResolver --> agent tools/context/skills
        |
        +--> session summaries ---------> UI session count/activity

GET /api/projects --------------------> UI project baseline
```

`ProjectManager` 能感知默认 workspace、项目 store 和本地文件系统；不能感知 HTTP、CLI、React 或 session UI 状态。`SessionManager` 长期持有 `ProjectManager` 作为稳定业务协作者；项目 owner 不反向依赖 session owner。kernel 启动时负责一次性编排历史 session 项目导入。

## 目录组织

kernel 保持现有 L1 包内结构，不新增 `features/projects` 或新 package：

- `managers/project.manager.ts`：项目不变量、创建流程与模板物化 owner。
- `stores/project.store.ts`：项目注册表持久化。
- `types/project.types.ts`：纯项目合同。
- `tools/project.tools.ts`：agent-facing 项目 tools。
- `tools/session-update.tools.ts`：agent-facing 会话更新 tool。

server 作为 L2 多 feature 应增加 `features/projects/`，只包含 controller 和唯一 `index.ts` 边界。client SDK 延续现有 `services/*.service.ts` 结构增加 projects service。UI 在 chat 下增加轻量 project feature，只承载创建项目 dialog；projects query、纯投影 utils 和已有会话项目表单仍复用 shared/chat owner，不新建平行 store。

本设计放在 `docs/designs`，因为它定义稳定实体、owner、数据流、持久化与外部合同；它不是未定型 thought，也不是仅列执行步骤的 plan。

## 兼容与迁移

- 保留并继续读取既有 session `metadata.project_root`，因为它是已发布的持久化用户数据。
- kernel 启动时显式导入仍然存在的历史 session 项目目录，建立项目注册表；缺失目录不自动创建。
- `metadata.projectRoot` 只作为既有 legacy 读兼容；所有新写入统一使用 `project_root`，清除时同时删除两者。
- 默认 workspace 符号或解析后等于默认 workspace 的路径始终折叠为“无显式项目”，不导入注册表。
- 不保留第二套项目列表、API alias、CLI alias 或 tool alias。

## 验收标准

- 隔离 `NEXTCLAW_HOME` 中，`projects create --template empty` 创建空目录并写入注册表，`projects list --json` 能读回零会话项目。
- `knowledge-base` 模板只在空目标目录中创建约定结构，不覆盖非空目录。
- 已有目录被会话绑定后自动进入项目列表；默认 workspace 不进入项目列表且不写入 session `project_root`。
- `sessions rename` 与 `sessions set-project/clear-project` 修改真实 session journal，API 和 `sessions_list`/session summary 读回一致结果。
- `projects_list`、`projects_create`、`sessions_update` tools 直接调用 kernel owner，并有定向执行测试。
- project-first 侧边栏与欢迎页能显示零会话项目；项目会话数和最近活动仍由 session summaries 派生。
- project-first 侧边栏提供“新建项目”表单，可选择空项目或知识库模板；创建成功后无需刷新页面即可显示零会话项目。
- 新建项目的目标目录使用共享服务端目录选择器；选择器具备左侧常用位置、顶部导航/面包屑地址栏/搜索、名称与类型目录列表、底部待确认目录，固定提示“单击选择，双击进入”，支持左侧位置单击跳转、右侧目录单击选择、双击或 Enter 进入、方向键选择、历史前进/后退、刷新与新建文件夹，且创建文件夹后留在当前层并选中新目录。
- macOS 服务端存在对应目录时，常用位置显示桌面、文稿、下载、iCloud 云盘、应用程序，并在“位置”分组显示磁盘与卷和文件系统；不存在的服务端目录不伪造入口。
- Windows 服务端接受盘符绝对路径、UNC 网络路径和 `~\\...` home 路径；桌面与文稿优先使用实际存在的 OneDrive 重定向目录，当前盘符根目录可从“文件系统”进入。
- Linux 服务端接受 POSIX 绝对路径；桌面、文稿和下载优先遵循 XDG `user-dirs.dirs`，配置缺失或目标不存在时才使用实际存在的英文默认目录。
- `desktop-validate` 在 Ubuntu、macOS 与 Windows 既有 runner 中执行同一 server path controller 测试，防止只在开发机平台通过。
- 选择器打开周期内只有一个交互状态 owner，不用 React effect 镜像 browse query 或批量重置本地状态；1280px 桌面视口下弹窗内容不产生横向溢出。
- 默认 workdir 使用 `~` 表示时，服务端解析后地址栏与待确认目录显示同一个规范绝对路径；旧 home browse response 不能覆盖本次显式路径。
- 无显式项目的会话打开设置目录表单时，输入值和浏览起点为该 session 的有效 `workingDir`，保存默认 workdir 后仍不形成显式项目。
- 触达的 TypeScript packages 通过 `tsc`、定向测试、targeted lint、治理检查与 maintainability guard。
- 使用源码 CLI 在隔离环境完成创建项目、列出项目、改名会话、设置/清除项目的真实冒烟。

## 非目标

- 不实现项目删除、重命名、移动、归档或权限模型。
- 不实现远程项目、多目录项目或云端同步。
- 不新增完整项目管理页面；本轮 UI 使用项目视图内的轻量创建 dialog，删除、重命名、移动等完整管理能力仍不在范围内。
- 不改变默认 workspace 的配置 owner，也不把它升级成普通项目。
- 不重写现有 session project context、skills 加载和 workingDir 派生算法。

## 后续实现顺序

1. 实现 project types/store/manager，并接入 kernel composition root。
2. 把 session settings patch 收回 `SessionManager`，接通项目自动登记与历史导入。
3. 增加 agent tools 与 CLI 命令，更新自管理指南。
4. 增加 projects HTTP/client SDK/UI query，把项目列表接入 sidebar/welcome 投影并提供 UI 创建 dialog。
5. 按 Windows 文件夹选择器主交互模型重构共享服务端目录选择器，增加位置导航、独立浏览/选择状态、导航历史、新建文件夹 API 与键盘交互，并接入项目创建 dialog。
6. 优化无项目会话的目录表单默认 workdir，并消除显式路径与旧 browse response 的初始化竞态。
7. 完成单测、tsc、lint、CLI/tool/API/UI 冒烟与治理收尾。
