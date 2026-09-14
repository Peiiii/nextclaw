# 移动端密度修复与 0.56.0 发布

## 迭代完成说明

恢复窄屏输入栏图标展示、紧凑消息操作与32px思考菜单，收紧工作台标签及文件面包屑；收件箱详情改用单行顶栏并将更多操作置于最右侧；项目详情返回原会话项目视图。消息处理汇总统一为“已处理＋耗时”，具体工具错误保留详情。

历史工具栏重构删除窄容器约束，共享触控高度和容器 padding 叠加导致密度回归；源码、历史 diff 与浏览器最终尺寸共同确认。展开动画只测量一次目标高度，异步详情替换骨架时会跳变，改由原动画 owner 观察并衔接高度变化。处理汇总误将运行 outcome 当作过程标题，删除这一映射。完整设计与验证见 `docs/designs/2026-09-13-mobile-experience.design.md`。

主干另有已提交的 Markdown 文档属性功能等待发布，因此完整批次选择 minor 0.56.0，而非只按本次修复选择 patch。

## 测试/验证/验收方式

两包 tsc、触达 TS/TSX ESLint、定向组件与路由测试通过；浏览器320/390/430px及桌面检查，实测面包屑整行32px、思考选项32px。项目分组→详情→工作项→返回原分组实测通过。未声称完成真机键盘和触控手感验收。

发布 Actions 完成16组平台/Node兼容性及不支持版本检查，runtime owner完成公开渠道验证，parent完成上一 stable 的检查、下载、应用和新进程升级验证。公开四平台 manifest 均为0.56.0，hostKind为npm-runtime-bundle，minimumLauncherVersion为0.18.11。

## 发布/部署方式

用户授权合入主干、NPM与runtime bundle。修复提交530b295cd已推送；一次 dispatch `release.yml target=product`，run 34796907087，冻结 source 530b295cde8b4c9cbc67fd6b35f3b6a743d223e4。NPM版本提交ea2483656回流主干。Runtime child 34797992494成功，四个平台 zip 均附于 GitHub `nextclaw@0.56.0` Release。未发布桌面安装包；独立宣传内容状态为CONTENT_PENDING，不影响授权的NPM/runtime完成点。

正式流程从01:44:41至02:07:49 UTC，共23分08秒；NPM_READY于01:52:30，耗时7分49秒，time budget: missed。Runtime child promotion及公开Pages从02:04:53至02:06:02，69秒，满足120秒预算。主要延迟是预构建等待和Windows冷安装验证，已有NPM/Runtime预构建并行复用，不重复构建或发布。

AUTOMATION_INTERVENTIONS: 1。Windows/Node20安装命令超过5分钟上限，尚未执行SQLite断言；同一run仅重试failed jobs后通过，成功NPM及其它矩阵证据全部保留。网络或runner变慢的具体来源未完全定位。自动化消除落点为原安装验证脚本：Windows单次安装预算改为10分钟，仍受12分钟job总上限约束，平台及功能断言不变；避免因过紧的局部预算触发整项冷安装重试。该局部预算调整通过语法、5项已有脚本测试和diff维护性检查；本次真实恢复仍使用冻结源码，不将其声称为新时限的Windows实测。

## 用户/产品视角的验收步骤

手机打开收件箱报告，正文占据顶栏以下空间，继续聊左侧、更多最右；打开思考菜单和文件路径观察紧凑高度；从项目分组进入详情并返回；展开消息过程查看工具详情，收起后标题不再显示处理失败。安装 `nextclaw@latest` 或使用现有更新入口获取0.56.0。

## 可维护性总结汇总

复用原组件、Router与动画owner；移除汇总错误映射，无新增业务状态或平行实现。密度验收规则更新原owner，无新增发现入口。源码维护性0错误、4项既有预算提示，主观复核无阻断；发布脚本调整0错误、1项原目录预算提示，没有新文件或目录扩散。

## NPM 包发布记录

- nextclaw 0.56.0：已发布，latest核验一致。
- @nextclaw/ui 0.26.5：已发布，latest核验一致。
- @nextclaw/agent-chat-ui 0.12.0：已发布，latest核验一致。
- Runtime 0.56.0：darwin-arm64、darwin-x64、linux-x64、win32-x64四平台已发布，公开manifest核验通过。

发布入口：https://github.com/Peiiii/nextclaw/actions/runs/34796907087

产物：https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.56.0
