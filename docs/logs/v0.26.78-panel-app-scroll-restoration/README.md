# v0.26.78 Panel App 滚动恢复

## 迭代完成说明

本迭代为全局 Doc Browser 中受控 Panel App 增加浏览器式滚动恢复。用户滚动页面主区域或内部滚动容器后，点击面板标题栏的刷新按钮，新的 iframe 会恢复同一 tab、同一 URL 的最后阅读位置。

根因是刷新会销毁旧 iframe，而宿主受 sandbox 限制无法直接读取其中的滚动状态。首次实现虽然通过注入 bridge 上报并回放了位置，但 Panel App 的 iframe `load` 早于应用异步读取数据和渲染；页面高度尚未撑开时调用 `scrollTo` 会被浏览器钳制到顶部。开发态真实链路探针确认了“位置已捕获、恢复消息已送达、首次应用被高度钳制、异步渲染随后完成”的完整时序。

修复将滚动事实归属到 Panel App bridge，将 tab 生命周期和恢复时机归属到 Doc Browser。bridge 在内容尚未就绪时观察文档尺寸与 DOM 变化，目标坐标真正生效后立即停止，最长十秒清理；没有增加跨域 DOM 猜测或第二条恢复路径。

## 测试/验证/验收方式

- `@nextclaw/kernel` TypeScript 检查通过。
- Panel App bridge 定向测试 5/5 通过，覆盖页面主滚动、嵌套滚动面和异步内容撑开后的恢复。
- Doc Browser 定向组件测试 20/20 通过，覆盖点击“刷新当前面板应用”后向新 iframe 回放位置。
- 相关源码 targeted ESLint、diff check、文件与目录治理检查通过。
- 在 `http://127.0.0.1:5174` 开发态打开“面试准备大盘”，滚动到 `scrollY = 432` 后点击面板标题栏刷新按钮；异步渲染完成后仍为 `scrollY = 432`。

## 发布/部署方式

本次只完成源码提交，不执行发布或线上部署。开发态由 Vite 与 `tsx watch` 自动加载改动，无需手工重建或重启。正式产品行为随后续统一 NPM/运行时发布进入交付渠道。

## 用户/产品视角的验收步骤

1. 在全局右侧面板打开一个内容足够长的 Panel App。
2. 向下滚动到容易辨认的内容区域。
3. 点击面板标题栏右侧的刷新按钮。
4. 等待应用数据加载完成，确认仍停留在刷新前的阅读位置，而不是跳回顶部。

## 可维护性总结汇总

本次保持单一恢复链路：shared config 是跨包协议唯一事实源，Panel App bridge 负责文档内滚动事实与布局就绪，Doc Browser 私有 hook 负责按 tab/URL 保存临时快照和 iframe load 回放。没有新增 store、manager、外部 iframe fallback 或应用级定制代码。

自动 maintainability guard 无阻塞项，提示 bridge 源文件和相关测试接近各自行数预算。主观复核认为当前能力仍属于既有 Panel App bridge 的单一 owner，立即拆文件只会增加注入脚本的阅读跳转；后续若再新增独立 bridge 能力，应优先拆分角色明确的脚本构造模块。Doc Browser 测试增长来自对真实刷新链路的行为覆盖，没有复制生产实现。

## NPM 包发布记录

需要随统一发布批次发布，当前未发布：

- `@nextclaw/shared`：patch，新增滚动恢复消息合同。
- `@nextclaw/kernel`：patch，注入 Panel App 滚动观察与恢复 runtime。
- `@nextclaw/ui`：patch，保存并回放每个 Panel App tab 的滚动快照。
- `nextclaw`：patch，向最终用户交付该产品行为。

状态：待统一发布。
