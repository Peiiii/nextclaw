# 当前执行状态

- 目标与有效合同：[验收合同](acceptance-contract.md)，revision 2。体验及性能优先，开发成本次级；长期偏好已保存个人知识库。
- 唯一写入区：`/Users/peiwang/.codex/worktrees/bibo-markdown-editor/nextbot`，基线 `6337915a9`。主工作区原有 WIP 未改。
- flow: standard，L3 实现 / L4 上线。单代理，继承上线授权。
- 选型：Tiptap 3.31.3 + ProseMirror；源码 CodeMirror。Milkdown 实验已移除。比较证据及边界见选型实验。
- 已实现：默认阅读，正文直接编辑，表格/链接/图片/公式/图表，源码次级入口，两内核懒加载，250ms 静默转换及保存/离开即时同步，原文保留节点，窄屏菜单。
- 真实页面 1440/390/320px：输入与中文 IME、跨段删除、撤销重做、表格行列、公式、链接/图片、源码保真、草稿/失败/冲突/并发保存、滚动和边界通过；持续补充 Mermaid 回归。
- 实际集成 300 节 / CPU4x 按键到下一帧 p95 17.9ms（本机 Chromium 探索性结果，不代表真机全部范围）。
- 本地用户预览：`http://127.0.0.1:43988/files/6672ac2a-bcd6-4833-8bde-ea54becec684`；Vite mode ui，独立临时数据，进程需保留供用户反馈。
- UI/宿主 tsc 和初轮 production build 已通过；原产品 smoke 通过。当前收尾验证、Review 未完；尚未 commit/push/deploy，本任务不可宣称上线。
- 下一步：完成剩余验证、Review、更新合同证据、冻结远程 master 部署 client、真实保存刷新、主线回流。用户可边预览边反馈，无待决批准。
