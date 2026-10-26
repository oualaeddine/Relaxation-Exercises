import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { DESKTOP_QUERY, useMediaQuery, useReducedMotion } from '../app/hooks';
import { useAppData } from '../app/AppData';
import { Icon, type IconName } from '../ui/Icon';
import { LogoMark } from '../ui/Logo';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const NAV: readonly NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'spa' },
  { to: '/exercices', label: 'Exercices', icon: 'grid_view' },
  { to: '/pratique', label: 'Pratique', icon: 'air' },
  { to: '/suivi', label: 'Mon suivi', icon: 'bar_chart' },
  { to: '/parametres', label: 'Paramètres', icon: 'tune' },
];

interface PageLayoutProps {
  /** `tab`: top-level page with bottom navigation; `sub`: detail/practice page with a back button. */
  variant: 'tab' | 'sub';
  title: string;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
  /** Wider content for dashboards and the desktop practice layout. */
  wide?: boolean;
  headerAction?: ReactNode;
}

function StorageBanner() {
  const { persistent } = useAppData();
  if (persistent) return null;
  return (
    <div role="status" className="mb-space-md flex items-start gap-2 rounded-2xl bg-error-container p-3 text-on-error-container">
      <Icon name="warning" size={20} className="mt-0.5" />
      <p className="font-body-sm text-body-sm">
        Le stockage local de votre navigateur est indisponible (navigation privée ou cookies bloqués). Vos séances ne seront pas
        conservées après la fermeture de la page.
      </p>
    </div>
  );
}

function DesktopNav() {
  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex min-h-[44px] items-center gap-1.5 rounded-full px-4 font-label-lg text-label-lg transition-colors ${
              isActive ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
            }`
          }
        >
          <Icon name={item.icon} size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-50 bg-surface/95 shadow-[0_-4px_20px_rgba(24,54,83,0.06)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-space-sm">
        {NAV.map((item) =>
          item.to === '/pratique' ? (
            <NavLink key={item.to} to={item.to} className="group -mt-5 flex min-h-[56px] min-w-[56px] flex-col items-center justify-center">
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-on-primary shadow-[0_8px_20px_rgba(24,54,83,0.22)] transition-all group-hover:bg-secondary group-active:scale-95 ${
                      isActive ? 'bg-secondary' : 'bg-primary-container'
                    }`}
                  >
                    <Icon name="air" size={28} />
                  </span>
                  <span className="mt-1 font-label-sm text-label-sm text-on-surface-variant group-hover:text-primary">{item.label}</span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-space-xs px-2 py-1 transition-colors ${
                  isActive ? 'font-bold text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <Icon name={item.icon} size={24} />
              <span className="font-label-sm text-label-sm">{item.label}</span>
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}

export function PageLayout({ variant, title, children, backTo, backLabel = 'Retour', wide = false, headerAction }: PageLayoutProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const showBottomNav = variant === 'tab' && !desktop;

  return (
    <div className={`flex min-h-screen flex-col bg-surface ${reduce ? 'reduce-motion' : ''}`}>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-primary-container focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Aller au contenu
      </a>
      <header className="pt-safe fixed inset-x-0 top-0 z-50 bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className={`mx-auto flex h-16 items-center justify-between gap-space-sm px-margin ${desktop ? 'max-w-[1200px] lg:h-20' : ''}`}>
          <div className="flex min-w-0 items-center gap-space-sm">
            {variant === 'sub' ? (
              <button
                type="button"
                aria-label={backLabel}
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full text-primary transition-all hover:bg-surface-container active:scale-95 lg:px-3"
              >
                <Icon name="arrow_back" size={24} />
                {desktop ? <span className="font-label-lg text-label-lg">{backLabel}</span> : null}
              </button>
            ) : null}
            {variant === 'tab' || desktop ? (
              <Link to="/" className="flex min-h-[44px] min-w-0 items-center gap-space-sm rounded-xl">
                <LogoMark className="h-8 w-8" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-headline-sm text-headline-sm tracking-tight text-primary">Calme</span>
                  {variant === 'tab' && !desktop ? (
                    // Visual page subtitle only: the link's accessible name stays "Calme".
                    <span aria-hidden="true" className="truncate font-label-sm text-label-sm text-on-surface-variant">
                      {title}
                    </span>
                  ) : null}
                </span>
              </Link>
            ) : (
              <h1 className="truncate font-headline-sm text-headline-sm text-primary">{title}</h1>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-space-sm">
            {desktop ? <DesktopNav /> : null}
            {headerAction}
            {!desktop ? (
              <Link
                to="/parametres"
                aria-label="Paramètres et confidentialité"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-[0_2px_8px_rgba(24,54,83,0.08)]">
                  <Icon name="person" size={20} />
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main
        id="contenu"
        tabIndex={-1}
        className={`relative mx-auto flex w-full flex-1 flex-col px-margin pt-20 outline-none lg:pt-28 ${
          showBottomNav ? 'pb-32' : 'pb-12'
        } ${wide ? 'max-w-[1200px]' : 'max-w-2xl'}`}
      >
        {variant === 'sub' && desktop ? <h1 className="sr-only">{title}</h1> : null}
        {variant === 'tab' ? <h1 className="sr-only">{title}</h1> : null}
        <StorageBanner />
        {children}
      </main>
      {desktop ? (
        <footer className="w-full bg-surface-container-low py-space-lg">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-space-md px-margin font-body-sm text-body-sm text-on-surface-variant md:flex-row">
            <span>Calme • Respiration & pleine conscience — vos données restent sur cet appareil.</span>
            <span>Ces pratiques ne remplacent pas un avis médical.</span>
          </div>
        </footer>
      ) : null}
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
