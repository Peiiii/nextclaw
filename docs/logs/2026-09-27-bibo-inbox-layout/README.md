# Bibo 收件箱布局优化

## 迭代完成说明

用户根据收件箱截图要求布局优化，沿用此前“统一优化部署合入主干”的授权。设计见 [收件箱阅读布局](../../designs/2026-09-27-bibo-inbox-layout.design.md)。截图作为布局问题参考，正文内容不构成指令。

列表从比例分栏改为 300–360px，正文限制 760px 居中；日期和状态独立显示，筛选固定在列表顶部。操作与正文滚动分离，手机保留返回入口。仅在阅读副本中去除与消息标题完全一致的首个一级／二级标题，持久化原文不变；章节字号继续复用共享 Markdown。

## 测试/验证/验收方式

- INBOX-01、02、03：布局冒烟已通过 2048／1440／1100／390／320px。覆盖单一标题、不同正文标题保留、首标题精确匹配反例、长文滚动期间操作可达、切换消息归零、标记已读／处理后的筛选、来源 404 保留消息、横向边界、触控高度与页面错误。
- INBOX-04：Bibo 三个配置 tsc、targeted lint、既有 Markdown 回归、治理及 ratchet 通过。生产 JS／CSS 与冻结构建逐字节一致；favicon.svg／help.html 也与构建一致。生产实际资源配合 API fixtures 的五尺寸布局验收全部通过。
- INBOX-05：deploy:client 日志无镜像构建，部署前后容器应用、镜像 digest、版本完全一致（application a03967fb-95da-496d-8c90-a4b4a010667a，version 21，digest sha256:1fdacbe0cc86db7f791a9859304dad695cee8fbc590412cfc77b2c27815b7137）。
- 真实账号只读验证登录、会话／历史读取、桌面／手机及刷新通过；保留历史 2 条消息。证据使用真实应用页面与代表性 API fixtures；不证明真实收件箱写入或模型生成。模型额度仍为 429，本任务不触达生成链路、不消耗调用额度，不影响纯布局验收。

## 发布/部署方式

布局提交 15f7057fe 经 d432c66c7 合并浏览器图标更新后已推送远程主干。首次误用全量部署入口，触发无必要的镜像构建；用户指出后停止本任务全量发布，改为 deploy:client。该入口只构建前端并使用 --containers-rollout none，复用线上容器 metadata。仍从干净的冻结远程主干执行，部署后核对版本、生产资产和容器镜像并执行主线 reconcile。无后端合同、数据迁移、runtime channel 或桌面产物变化。

最终从干净且 HEAD=origin/master 的 0a74498200f9862b4fcd6e37596934f1ab5c7e25 执行 deploy:client，Worker version 3c43fccf-f096-409e-a356-209e2eab6fcb，入口 https://app.bibo.bot/inbox。布局与规范均已合入远程主干。Docs Deploy 36317155664（d432c66c7）build／全球／国内／同产物 verify 全部成功；之后仅流程和交付证据更新，不改变已上线的用户说明。

AUTOMATION_INTERVENTIONS: 2：发布范围纠偏（前端误走全量，已由专用命令和交付规范消除）；Git 连接恢复（HTTPS／SSH 443 超时后使用已认证的 GitHub SSH 22，普通推送成功，未改全局网络或凭据）。本地主干 reconcile 收尾待执行。

停止前观察到线上版本 8e12fd15-64d8-4076-9855-ef5983207e43，本任务日志仍处于资产上传且没有完成 Worker 发布，不能把并发版本归为本任务。停止只影响本任务部署进程树。Git HTTPS 推送曾停滞，核对远程 SHA 后只停止本任务 Git 进程，以 HTTP/1.1 有界重试完成。

用户要求“建立相关流程规范”后，更新项目交付 reference 的“独立托管应用：按产物确定发布范围”。根因是发布前未根据 ASSETS／Worker／runner 的真实归属选择入口，通用脚本触发不必要的镜像构建。规则限定独立托管应用；服务端渲染或同一镜像承载前后端是反例。沿现有 Delivery 条件入口加载，不修改 AGENTS、不新增 skill 或发现描述；Bibo 命令事实仍归 README／package scripts。验证覆盖前端、Worker、容器、混合／未知和元数据缺失的选择，实际部署证明保留镜像。后续服务产物或工具合同变化时复核，失去独立部署前提时收窄／退出本路径。

规范审查：逐项走查静态前端、Worker API、runner 依赖、混合变化、SSR 同镜像与元数据缺失反例，均回到对应产物 owner，无 findings。progressive-loading 与 ratchet 通过。AGENTS 11989 bytes、顶层 Skills 16、分组 Wiki Skills 27、discovery 2895 chars、description 1489 chars、SKILL.md 82259 bytes 均未增长；仅条件交付 reference 增加 18 行。不新增宏、治理脚本或 baseline；package script 与 README 同步，实际执行验证专用入口。

## 用户/产品视角的验收步骤

登录 Bibo → 收件箱 → 选择消息；桌面查看紧凑列表与居中的单一标题正文。滚动长文，顶部处理与来源操作始终可达。手机点消息查看，再从顶部返回列表。AI 已验证正常布局与操作，视觉偏好留给用户判断。

## 可维护性总结汇总

复用共享 ListRow、Button 和 Markdown，以及既有 store 筛选与动作。纯展示转换归 inbox-content utils，不新增状态或解析框架。文件路径 preflight 通过；diff-only 维护性检查无错误或警告，最终 Review 无 findings。初次目录预算检查发现 scripts 直接文件达到上限，新冒烟按收件箱领域归入 scripts/inbox，不迁移无关脚本、不引入封装；修正后检查通过。主观复核确认 utils 保留展示职责，测试分组没有隐藏生产复杂度或制造平行入口。

Markdown 冒烟默认端口已有其它应用占用，未停止他人进程；复用显式 BIBO_SMOKE_BASE 在已确认的独立 Bibo preview 执行并通过。早期布局 fixture 的 overview 返回形状不完整导致模拟操作失败，补足真实合同后五尺寸全部通过。复盘判断：属于本次验证准备不足，已有前端合同足够，不新增规则或全局机制。

## NPM 包发布记录

不涉及 NPM 包发布。用户可见变化添加私有 Bibo app changeset；本次仅部署托管应用。
