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
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent/70 hover:text-accent-foreground'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
