import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  createPopoverAvailableHeightLimit,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

type SearchableModelInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  emptyText: string;
  createText: string;
  toggleLabel: string;
  maxItems?: number;
  onEnter?: () => void;
};

const SEARCHABLE_MODEL_MENU_MAX_HEIGHT = createPopoverAvailableHeightLimit('15rem');

function normalizeOptions(options: string[]): string[] {
  const deduped = new Set<string>();
  for (const option of options) {
    const trimmed = option.trim();
    if (trimmed.length > 0) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

export function SearchableModelInput({
  id,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  className,
  inputClassName,
  emptyText,
  createText,
  toggleLabel,
  maxItems = Number.POSITIVE_INFINITY,
  onEnter
}: SearchableModelInputProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const query = value.trim().toLowerCase();

  const orderedOptions = useMemo(() => {
    const indexed = normalizedOptions.map((option, index) => ({ option, index }));
    if (query.length > 0) {
      indexed.sort((left, right) => {
        const leftText = left.option.toLowerCase();
        const rightText = right.option.toLowerCase();
        const leftRank = leftText === query ? 0 : leftText.startsWith(query) ? 1 : leftText.includes(query) ? 2 : 3;
        const rightRank =
          rightText === query ? 0 : rightText.startsWith(query) ? 1 : rightText.includes(query) ? 2 : 3;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.index - right.index;
      });
    }
    const sorted = indexed.map((item) => item.option);
    if (Number.isFinite(maxItems)) {
      return sorted.slice(0, Math.max(1, maxItems));
    }
    return sorted;
  }, [normalizedOptions, query, maxItems]);

  const hasExactMatch = value.trim().length > 0 && normalizedOptions.some((option) => option === value.trim());
  const closeMenu = () => setOpen(false);

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(nextOpen) => setOpen(!disabled && nextOpen)}
    >
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Input
            id={id}
            value={value}
            disabled={disabled}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
              }
            }}
            onChange={(event) => {
              onChange(event.target.value);
              if (!open && !disabled) {
                setOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                if (onEnter) {
                  event.preventDefault();
                  onEnter();
                }
                closeMenu();
              }
            }}
            placeholder={placeholder}
            className={cn('pr-10', inputClassName)}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            className={cn(
              'absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center',
              disabled ? 'cursor-not-allowed text-gray-300' : 'text-gray-400 hover:text-gray-600'
            )}
            aria-label={toggleLabel}
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="flex w-[var(--radix-popover-trigger-width)] min-w-[12rem] flex-col overflow-hidden rounded-xl border border-gray-200 p-0 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        style={{ maxHeight: SEARCHABLE_MODEL_MENU_MAX_HEIGHT }}
      >
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
          {!hasExactMatch && value.trim().length > 0 && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(value.trim());
                closeMenu();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <Check className="h-4 w-4 text-transparent" />
              <span className="truncate text-gray-700">
                {createText.replace('{value}', value.trim())}
              </span>
            </button>
          )}

          {orderedOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                closeMenu();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <Check className={cn('h-4 w-4', option === value.trim() ? 'text-primary' : 'text-transparent')} />
              <span className="truncate text-gray-700">{option}</span>
            </button>
          ))}

          {orderedOptions.length === 0 && value.trim().length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyText}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
