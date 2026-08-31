# @nextclaw/desktop-extension-wechat

## 0.2.2-beta.0

### Patch Changes

- @nextclaw/extension-sdk@0.5.2-beta.0

## 0.2.1

### Patch Changes

- @nextclaw/extension-sdk@0.5.1

## 0.2.0

### Minor Changes

- f80df69: 新增统一的桌面应用授权与操作链路。NextClaw AI 现在可以在受限 `node_repl` 中使用私有 `desktop` SDK，在用户按 Agent 和目标应用授权后读取有界界面、点击、写入文本或发送常用按键；设置中可检查 macOS 辅助功能状态、查看并撤销 Agent 与 Extension 的应用访问许可。

  新增微信桌面观察 Extension，可把当前微信窗口的可见内容作为会话上下文，并通过持续关注关系将新出现的可见消息送回原会话。桌面 SDK 不按“发送”或“确认”等控件文案另设产品级阻断；系统权限、用户 grant、目标窗口绑定和审计仍然有效。

  Panel App 与 Service App 现在复用同一授权存储和撤销语义：启用、禁用、卸载或失败恢复时，会一并保持或恢复关联的面板状态、桥接会话与服务动作授权，避免包生命周期留下失效或越权的调用路径。

  平台支持由统一 feature-controls 合同提供；当前运行环境不支持桌面自动化时，不显示桌面操作设置入口。

### Patch Changes

- Updated dependencies [f80df69]
  - @nextclaw/extension-sdk@0.5.0
