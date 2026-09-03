# Project 移除能力执行计划

上位设计：[Project 移除能力设计](../designs/2026-09-03-project-deletion.design.md)

## 目标与边界

交付可从 UI 与 CLI 安全执行的 Project 移除能力，保持本地目录、历史会话和 Project Work，并让显式重新添加恢复原 Project。非目标沿用上位设计。

## 执行部分

1. **Kernel 生命周期与持久化**
   - Owner：`ProjectManager` / `ProjectStore`。
   - 输入：上位设计中的软移除、启动抑制与显式恢复合同。
   - 结果：v3 注册表、精确确认、移除与恢复同 ID；v1/v2 迁移不丢数据。
   - 验证：manager/store 定向测试与 kernel TypeScript 编译。
   - 设计策略：复用上位设计；若必须跨 session 或 Project Work owner 写入，返回 Design。

2. **公共入口与 UI 交互**
   - Owner：server controller、client SDK、Projects query hook、Project 页面和 CLI 薄适配。
   - 输入：kernel `removeProject` 公共合同。
   - 结果：DELETE API、SDK、清晰命名的按钮、影响说明二次确认、成功/失败反馈、CLI 精确确认。
   - 验证：controller、SDK、UI、service/CLI 定向测试及触达包 TypeScript 编译。
   - 设计策略：复用上位设计，不引入第二状态 owner。

3. **用户文档、Review 与主干交付**
   - Owner：命令文档、自管理资源、changeset、Lifecycle Delivery。
   - 输入：验证完成的真实命令与交互。
   - 结果：中英文说明同步、无未关闭 Review finding、提交经协调流程合入并推送 `origin/master`。
   - 验证：命令文档同步检查、diff-only maintainability guard、mainline reconcile 结果。
   - 设计策略：复用上位设计。

## 恢复入口

中断后先读取上位设计的 Active acceptance contract，再检查本计划三个部分和 `git status`。从首个未通过的 PD 编号继续，不从已有提交或版本号猜测完成状态。
