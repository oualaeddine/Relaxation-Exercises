import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../app/hooks';
import { PageLayout } from '../layout/AppShell';
import { Icon } from '../ui/Icon';

export function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  return (
    <PageLayout variant="tab" title="Page introuvable">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-container-lowest p-8 text-center shadow-sm">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-secondary">
          <Icon name="explore" size={32} />
        </span>
        <h2 className="font-headline-md text-headline-md text-primary">Cette page n’existe pas</h2>
        <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">Le lien suivi est peut-être incomplet. Respirez un instant, puis reprenez depuis l’accueil.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className="flex min-h-[48px] items-center rounded-full bg-primary-container px-5 font-label-lg text-label-lg text-on-primary hover:bg-secondary">
            Retour à l’accueil
          </Link>
          <Link to="/exercices" className="flex min-h-[48px] items-center rounded-full bg-surface-container px-5 font-label-lg text-label-lg text-primary">
            Voir les exercices
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
