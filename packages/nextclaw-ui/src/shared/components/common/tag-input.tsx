import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { TagChip } from "@/shared/components/ui/tag-chip";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  className,
  placeholder = "",
}: TagInputProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onChange([...value, input.trim()]);
      setInput("");
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "flex min-h-[42px] flex-wrap gap-2 rounded-xl border border-gray-200/80 bg-white p-2",
        className,
      )}
    >
      {value.map((tag, index) => (
        <TagChip key={index} tone="info" className="gap-1 px-2 py-1 text-sm">
          {tag}
          <button
            type="button"
            onClick={() => removeTag(index)}
            className="transition-colors hover:text-rose-200"
          >
            <X className="h-3 w-3" />
          </button>
        </TagChip>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 outline-none min-w-[100px] bg-transparent text-sm"
        placeholder={placeholder || t("enterTag")}
      />
    </div>
  );
}
