## 目录预算豁免

- 原因：该目录是 agent chat input bar 的当前组件边界，历史上同时承载 composer、toolbar、slash menu、skill picker 和贴近这些组件的测试入口。当前保持扁平是为了避免在输入主链路仍持续调整时提前制造多层跳转。
- 后续拆分缝：新增复杂 composer 内部实现优先进入 `lexical/` 或新的语义子目录；新增独立面板、菜单或 toolbar 子能力应优先拆到对应子目录，不再继续扩大本目录根部文件数。
