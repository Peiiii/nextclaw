# Bibo Exa 网络搜索

## 迭代完成说明

用户要求按照Exa官方build-with-exa Skill给Bibo接入网页搜索并直接上线；实验期不以紧额度阻碍体验。已上线且完整真实浏览器验收通过。[设计与验收合同](../../designs/2026-09-27-bibo-exa-search.design.md)中EXA-01～05均已关闭。

复用kernel web_search，Exa使用auto与highlights；Bibo Worker验证账号token并原子预留搜索预算，平台key只在Worker Secret。每账号每天100次、全站每天1000次/每月10000次；模型对应每人每天250次/全站2000次；聊天由旧每小时12次放宽为100次。来源链接随回答走原会话、结构化空间与R2保存链路。

## 测试/验证/验收方式

Worker、网页、runner、core与live脚本类型检查，定向ESLint，Bibo52项测试与core2项测试通过。覆盖鉴权、固定上游选项、失败脱敏、120并发仅100成功、全站日/月预算及UTC重置、模型与搜索独立计数、100次小时聊天边界和滚动过期，内置身份更新及自定义身份保留。真实SQLite快照/空间恢复/会话删除和桌面手机客户端smoke通过。

独立开发运行完成Harness→搜索代理→真实Exa→真实DeepSeek回答，两次请求均返回200与8条带highlights的结果，回答引用Cloudflare官方来源。线上旧模型额度429已复现，因此不能把旧线上模型结果当作新版本通过。发布后smoke会独立验证模型流、搜索鉴权、Agent搜索/文件创建、已保存来源、刷新和桌面手机。

## 发布/部署方式

发布范围为Bibo Worker、Container与静态帮助；中英文文档中的Bibo专用说明随代码同步，不以公共文档站部署作为Bibo上线条件。不涉及NPM、NextClaw runtime、desktop更新，不增加Cloudflare付费资源或DO迁移。

同日Bibo文件展示发布已从冻结远程master `34a31c2e56359ecddcaa54ed3e4dc55e2542ea02` 带上完整搜索源码。核对搜索route、runner、模型预算和core适配器与当前源码一致，生产Container确为该镜像后，停止本任务重复构建。Worker小时额度和帮助页随后从干净冻结远程master `1199b44da` 经原 `pnpm -C apps/bibo-hosted run deploy:client` 入口更新；Container契约、配置和镜像未变。README明确Worker-only且不改变Container协议时可使用同一路径，不增加发布器。

最终Worker `b676d794-1e8e-43ed-baf0-b6ce681d5ade`；Container版本22，镜像 `sha256:b32bcfb2cde302b69944695df41ee5395ee3f27a6d1d6acc36cc1515f55b381a`，5实例healthy、零error。生产帮助页按正常重定向读取，Exa、日搜索100、小时聊天100与全站日模型2000均正确。

完整生产smoke `bibo-live-7170d130` 成功退出：模型首个内容3214ms、64个chunk；Exa代理10条结果与highlights，请求ID `33660514843f00d0627197aa9a2bcaf8`；真实搜索聊天13.082秒/242个delta，文件任务13.160秒/13个delta/1个展示事件。会话精确保存、来源可点击、文件精确保存/自动展示、并行领域读取、桌面1365与手机390刷新和Files读取均通过。只清理本次创建的文件与会话。早先同一搜索代码的Agent真实请求 `9804b6e7e762047c9f0aafc0d19d8953`、`09caeffe5682cab6ab599de8c6e4f876` 已由脱敏Worker日志确认；未落盘凭据、查询或网页正文。

## 可维护性与经验

diff-only guard零error，三项现有目录/临界文件warning；新增搜索归feature，预算复用既有DO且使用独立状态key。审查无开放finding。主工作区用户thought草稿哈希与任务前一致，本任务全部处于隔离worktree。

用户明确纠偏初期额度应服务试验体验，已落实到搜索和依赖的模型额度、边界测试和用户帮助；事实与决策留在本设计及服务README，不上升为全仓库流程。发布前发现本地主线落后，已保留草稿并迁移远程新个人空间能力；不为一次恢复新增规则。

## 用户/产品视角验收

打开https://app.bibo.bot并登录，直接输入“搜索Cloudflare AI Search的最新官方说明，并附来源链接”。预期得到检索后的回答与可点击官方来源，刷新后回复仍在；任务、日程和文件功能继续可用。

首次完整发布在容器依赖下载阶段停滞，npmmirror tarball出现ERR_SOCKET_TIMEOUT；尚未上传Worker或切换线上。停止本任务的构建进程后，将Bibo Dockerfile依赖源统一为已核验200的npm官方源，从原服务deploy入口重建，保留已配置Secret。未添加第二发布器或旁路配置。主线推送自动触发的Bibo文档说明部署与搜索运行无关，不作为Bibo部署完成点。

AUTOMATION_INTERVENTIONS: 3（依赖下载/打包恢复；本机磁盘耗尽后的环境恢复；线上遗留小时额度阻断连续试用后的源代码修复）。

同次容器依赖恢复进一步定位pnpm 9 deploy会重新解析全部workspace及开发依赖，拉入无关的个人空间UI与benchmark包。构建完成后，通过pnpm公开的生产依赖闭包列表缩小仅在builder中的workspace并删除开发依赖，仍由原deploy命令打包；仓库manifest和运行owner不变。诊断打包230个依赖、复用206个、下载3个，约21秒完成；完整镜像成功，镜像内真实Harness及传递依赖import通过。该变化只属于Bibo Dockerfile，不新增发布器、配置副本或通用治理脚本。

下一次构建在安装尾部遇到本机Docker接口整体超时。Docker日志确认2026-09-27T13:06:58Z出现no space left on device；普通restart超时后，停止本任务构建并恢复Docker进程。恢复后确认零运行容器；仅回收超过24小时、可重新生成的build cache（6.166GB），保留全部41个镜像和3个volume。主机可用空间恢复到22GiB，Docker API重新可用；此环境恢复不改变线上Worker或容器。

真实线上搜索已保存后，下一轮明确返回“本小时对话次数已用完”，确认旧12次/小时仍阻断实验体验。提高原Worker中的限额到100，保留已有计数与滚动一小时机制；不重置账号、不加绕过接口。小时边界、过期、52项测试及三套tsc通过后，仅更新Worker/资产，完整生产smoke通过。收尾维护性检查零error，两项目录/文件warning均来自既有主线且本次数量未增长；quota/source链接复核no findings。

恢复后的冷构建进一步避免无限悬挂：Corepack下载限制45秒并重试一次；frozen install降低网络并发、单请求30秒超时，并在同一builder步骤中以120秒期限重试一次以复用已下载包。最终原Bibo Dockerfile完整构建通过：安装111.2秒、Harness依赖图构建77.2秒、生产依赖打包12.6秒；本机验证镜像 `sha256:8f9d5bf009e7395356aee1b08d4946d0462da14fbfab0cf0a3820638d5546dad` 中真实Harness及搜索代理import检查通过。该镜像只用于验证发布入口修复，线上继续使用已验收的版本22，不做重复容器发布。
