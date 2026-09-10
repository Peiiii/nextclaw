# 分组下级 Skill

本目录承载不参与初始发现、由顶层或阶段 Skill 显式加载的完整下级 Skill。第一层目录是领域 namespace，不是 Skill；真正的 Skill 位于 `<group>/<skill-name>/SKILL.md`，保留名称、description、owner、触发条件、产物、references、scripts 和验证边界。

下级 Skill 不会因为存在于 Wiki 而自动加载。当前 Skill 必须说明命中条件并链接具体 `SKILL.md`；一次判断最多加载一个直接下级。只被一个 Skill 使用、且不需要独立合同的细节应回到该 owner 的 `references/`。

分组只解决导航和归属，不代表新的 workflow root，也不赋予组目录执行权。新增分组需要真实领域边界；禁止创建 `misc`、`common` 等垃圾桶。
