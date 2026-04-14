type StatCardProps = {
  label: string;
  value: string | number;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps): JSX.Element {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
