type TagChipProps = {
  children: string;
  tone?: "phase" | "type" | "source" | "neutral";
};

export function TagChip({ children, tone = "neutral" }: TagChipProps): JSX.Element {
  return (
    <span className={`tag-chip tag-chip--${tone}`}>
      {children}
    </span>
  );
}
