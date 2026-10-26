import { Link } from 'react-router-dom';
import { now } from '../app/clock';
import { practicePath, useSessionContext } from '../app/SessionContext';
import { getExercise } from '../domain/exercises';
import { formatClock } from '../domain/format';
import { activeMsAt, isLive } from '../engine/session';
import { Icon } from '../ui/Icon';

/** Shows a paused (or restored) session with a way back to it. */
export function LiveSessionBanner({ exceptExerciseId }: { exceptExerciseId?: string }) {
  const { session } = useSessionContext();
  if (!session || !isLive(session) || session.exerciseId === exceptExerciseId) return null;
  const exercise = getExercise(session.exerciseId);
  return (
    <section
      aria-label="Séance en cours"
      className="flex flex-col gap-3 rounded-2xl bg-secondary-container/50 p-space-md shadow-sm xs:flex-row xs:items-center xs:justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest text-secondary">
          <Icon name="pause_circle" size={22} filled />
        </span>
        <div>
          <p className="font-label-lg text-label-lg text-primary">
            {session.status === 'paused' ? 'Séance en pause' : 'Séance en cours'} : {exercise.title}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {formatClock(activeMsAt(session, now()))} de pratique active
          </p>
        </div>
      </div>
      <Link
        to={practicePath(session.exerciseId)}
        className="flex h-11 items-center justify-center gap-1 rounded-full bg-primary-container px-5 font-label-lg text-label-lg text-on-primary hover:bg-secondary"
      >
        <Icon name="play_arrow" size={20} filled />
        Reprendre
      </Link>
    </section>
  );
}
