import type { DayTotal } from '../domain/stats';

/** 7-day bar chart (minutes per day) from the Stitch home card, driven by real data. */
export function WeeklyChart({ days }: { days: DayTotal[] }) {
  const maxSeconds = Math.max(600, ...days.map((d) => d.seconds));
  const minutes = (s: number) => Math.round(s / 60);
  const summary = days.map((d) => `${d.label} ${minutes(d.seconds)} min`).join(', ');
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-surface-container-low/60 p-space-md">
      <svg role="img" aria-label={`Minutes de pratique par jour : ${summary}`} className="h-20 w-full overflow-visible" viewBox="0 0 280 80">
        <line stroke="#d2e4ff" strokeWidth="1" x1="0" x2="280" y1="70" y2="70" />
        <line stroke="#d2e4ff" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="280" y1="40" y2="40" />
        {days.map((day, i) => {
          const x = 10 + i * 40;
          if (day.seconds === 0) return <circle key={day.key} className="fill-outline-variant" cx={x + 11} cy={65} r={3} />;
          const height = Math.max(6, Math.round((day.seconds / maxSeconds) * 60));
          const fill = day.isToday ? 'fill-primary-container' : day.seconds >= maxSeconds * 0.8 ? 'fill-secondary' : 'fill-secondary-container';
          return <rect key={day.key} className={fill} height={height} rx={4} width={22} x={x} y={70 - height} />;
        })}
      </svg>
      <div className="flex justify-between px-1 text-center font-label-sm text-label-sm text-on-surface-variant" aria-hidden="true">
        {days.map((day) => (
          <span key={day.key} className={`w-7 ${day.isToday ? 'font-bold text-primary' : ''}`}>
            {day.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
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
  );
}
