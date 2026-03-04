export function Progress({ value, max = 100, className = "" }: { value: number; max?: number; className?: string }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`progress-root ${className}`.trim()}
    >
      <div
        className="progress-indicator"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
}
