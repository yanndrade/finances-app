type StatCardProps = {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
};

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <strong className="stat-card__value">{value}</strong>
    </article>
  );
}
