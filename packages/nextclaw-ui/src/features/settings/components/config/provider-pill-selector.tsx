type PillSelectOption = { value: string; label: string };
type ProviderPillSelectorProps = { value: string; onChange: (value: string) => void; options: PillSelectOption[] };

export type { PillSelectOption };

export function ProviderPillSelector(props: ProviderPillSelectorProps) {
  const { value, onChange, options } = props;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? 'border-foreground/15 bg-foreground text-background' : 'border-border/55 bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
