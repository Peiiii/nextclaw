# 用户 / 产品视角验收步骤

1. 打开 Providers 页面，选择你当前使用的 provider，确认 `apiKey/apiBase` 后点击“测试连接”。
2. 在 Chat 页面发送一条最小消息（例如“hi”）。
3. 若上游返回非标准结构，界面应显示可读错误信息，不再出现：
   - `TypeError: Cannot read properties of undefined (reading '0')`
4. 将同 provider 切换为 `wireApi=auto`（或保持默认）再次测试，确认在可回退场景下仍可继续工作。
