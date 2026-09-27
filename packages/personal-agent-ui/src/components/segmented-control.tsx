type Option<Value extends string> = { value: Value; label: string };

export function SegmentedControl<Value extends string>({ label, value, options, onChange }: {
  label: string;
  value: Value;
  options: readonly Option<Value>[];
  onChange: (value: Value) => void;
}) {
  return <div className="ui-segmented-control" role="group" aria-label={label}>{options.map((option) =>
    <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>,
  )}</div>;
}
