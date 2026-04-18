(module
  (func (export "summarize_notes") (param i32 i32) (result i32)
    local.get 0
    i32.const 100
    i32.mul
    local.get 1
    i32.add))
