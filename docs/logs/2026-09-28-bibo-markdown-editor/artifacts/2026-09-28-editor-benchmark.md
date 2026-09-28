# 编辑器选型实验

2026-09-28，本机 Chromium headless 1208、Vite 8.3.1 production build，Tiptap 3.31.3、Milkdown/Crepe 7.22.2。新浏览器上下文，中文标题、段落、行内格式、列表，每 10 节一张表和代码块。30/300 节分别为 3,641/36,700 字符。CPU 1x/4x；每组输入 30 个字符。原始数字见同目录 JSON。临时可复现实验在 `/tmp/bibo-editor-comparison`（非永久构建依赖）。

分离基础编辑与每次修改同步 Markdown 两种状态，避免把集成策略误判为内核本身。Tiptap 包含 StarterKit、Markdown、TableKit、Image、TaskList/TaskItem、Mathematics；Milkdown-core 为 commonmark/GFM/history；Crepe 默认完整特性。Crepe 额外控件比 Tiptap 原生文档节点多，因此完整 mount 不能当作同功能的绝对结论。数值是单机探索性观测，不代表全部设备或正式 Bibo 结果。

300 节 / CPU 4x：

| 指标 | Tiptap | Milkdown core | Crepe |
| --- | ---: | ---: | ---: |
| 不逐字转换，事务 p50 / p95 ms | 1.8 / 4.4 | 10 / 17.3 | 28.8 / 40.1 |
| Markdown 转换 p50 / p95 ms | 14.5 / 20 | 128.9 / 152.1 | 136.5 / 158.5 |
| 不逐字转换，打开 ms | 1026.5 | 796.5 | 2578.9 |

不能得出 Tiptap 在所有指标领先（纯 Milkdown 的该次打开更快），也不能把 Vue 存在当作性能差的充分证据。可以得出本场景中 Tiptap 的事务/转换有明显优势，更适合继续集成验证。实际实现仍应避免每次键入全量序列化及 React/store 同步放大。

保真实验发现：原生 Tiptap 将 frontmatter 变为分隔线/标题，误解释脚注，移除 HTML 注释/结构；Crepe 原生也误解释 frontmatter。Tiptap 用官方 custom Markdown tokenizer/schema 对这些内容作原文保留后，实验中的 frontmatter、脚注、HTML、数学、Mermaid 全部保留；引用式链接规范化为等价行内链接。该原型证明修复路径可行，不代替最终完整语料与保存回归。

结论：遵循用户体验优先的纠偏，选择 Tiptap 进入完整集成，承担必要的界面开发。移除 Milkdown/Crepe 实验依赖与主路径；不让先前投入决定选型。最终验收包括新增界面后的性能与保真。
