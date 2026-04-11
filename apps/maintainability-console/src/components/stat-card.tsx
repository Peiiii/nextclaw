type StatCardTone = "sunrise" | "ocean" | "mint" | "violet" | "amber" | "rose";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  tone: StatCardTone;
};

export function StatCard({ label, value, hint, tone }: StatCardProps): JSX.Element {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__hint">{hint}</div>
    </article>
  );
}
