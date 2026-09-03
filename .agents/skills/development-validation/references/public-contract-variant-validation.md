# 公开合同变体传播验证

适用于新增或扩展公开 schema、union、protocol、runtime kind 及其它闭集 variant。

- 以 Design 的传播矩阵为验证清单，确认每个适用 consumer 已接受新变体，并核对声明、产物与最终运行行为一致。
- 至少一条正向证据从最早 producer 贯通到最末 consumer；分散的 parser、serializer 或 consumer 单测不能替代首尾装配证据。
- 对安全、权限或数据完整性相关组合增加反例，证明不合法的 profile、protocol、artifact、permission 或 transport 组合在正确边界被拒绝。
- 因授权或外部状态无法经过真实分发、审核、安装或运行边界时，该格保持未验证，不得用局部替代证据宣称完整支持。
