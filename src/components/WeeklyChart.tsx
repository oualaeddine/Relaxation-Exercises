import type { DayTotal } from '../domain/stats';

/**
 * 7-day bar chart (minutes per day) from the Stitch home card, driven by real data.
 * Each day is a column so bars always line up with their labels at any width.
 */
export function WeeklyChart({ days }: { days: DayTotal[] }) {
  const maxSeconds = Math.max(600, ...days.map((d) => d.seconds));
  const minutes = (s: number) => Math.round(s / 60);
  const summary = days.map((d) => `${d.name} ${minutes(d.seconds)} min`).join(', ');
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-surface-container-low/60 p-space-md">
      <div role="img" aria-label={`Minutes de pratique par jour : ${summary}`} className="relative flex h-24 items-end justify-between gap-1 border-b border-surface-variant">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-surface-variant" />
        {days.map((day) => {
          const pct = day.seconds === 0 ? 0 : Math.max(8, Math.round((day.seconds / maxSeconds) * 100));
          const tone = day.isToday ? 'bg-primary-container' : day.seconds >= maxSeconds * 0.8 ? 'bg-secondary' : 'bg-secondary-container';
          return (
            <div key={day.key} className="relative flex h-full flex-1 items-end justify-center" data-testid={`bar-${day.key}`} data-seconds={day.seconds}>
              {day.seconds === 0 ? (
                <span className="mb-1 h-1.5 w-1.5 rounded-full bg-outline-variant" />
              ) : (
                <span className={`w-full max-w-[22px] rounded-t ${tone}`} style={{ height: `${pct}%` }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1 text-center font-label-sm text-label-sm text-on-surface-variant" aria-hidden="true">
        {days.map((day) => (
          <span key={day.key} className={`flex-1 ${day.isToday ? 'font-bold text-primary' : ''}`}>
            {day.label}
          </span>
        ))}
      </div>
      {/* Tables ignore the 1px width of .sr-only, so the wrapper carries it. */}
      <div className="sr-only">
        <table>
          <caption>Minutes de pratique des sept derniers jours</caption>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">Minutes</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.key}>
                <td>{day.name}</td>
                <td>{minutes(day.seconds)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
