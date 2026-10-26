import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppDataProvider } from './app/AppData';
import { SessionProvider, practicePath, useSessionContext } from './app/SessionContext';
import { isLive } from './engine/session';
import type { KeyValueStore } from './storage/store';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';

/** `/pratique` resumes the live session, or opens the recommended exercise. */
function PracticeHub() {
  const { session } = useSessionContext();
  const target = session && isLive(session) ? practicePath(session.exerciseId) : practicePath('respiration-lente');
  return <Navigate to={target} replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/exercices" element={<LibraryPage />} />
        <Route path="/exercices/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="/pratique" element={<PracticeHub />} />
        <Route path="/pratique/:exerciseId" element={<PracticePage />} />
        <Route path="/suivi" element={<HistoryPage />} />
        <Route path="/parametres" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export function App({ store }: { store?: KeyValueStore }) {
  return (
    <AppDataProvider store={store}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </AppDataProvider>
  );
}
