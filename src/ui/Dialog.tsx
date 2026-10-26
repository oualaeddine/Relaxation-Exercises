import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional descriptive text, wired to aria-describedby. */
  description?: ReactNode;
  icon?: Parameters<typeof Icon>[0]['name'];
  /** Bottom sheet on mobile (library details), centred card otherwise. */
  variant?: 'center' | 'sheet';
  /** Selector of the element focused when opening (defaults to the first focusable). */
  initialFocus?: string;
  /** Whether Escape / scrim click close the dialog. */
  dismissible?: boolean;
  showClose?: boolean;
  labelledBy?: string;
}

/**
 * Accessible modal dialog: focus moves inside, Tab is trapped, Escape closes, focus returns to
 * the opener, and the rest of the app is made inert while open.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  description,
  icon,
  variant = 'center',
  initialFocus,
  dismissible = true,
  showClose = false,
}: DialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    const panel = panelRef.current;
    const target =
      (initialFocus ? panel?.querySelector<HTMLElement>(initialFocus) : null) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    target?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('inert'));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, dismissible, initialFocus]);

  if (!open) return null;

  const sheet = variant === 'sheet';
  return createPortal(
    <div
      role="presentation"
      className={`fixed inset-0 z-[60] flex justify-center bg-primary-container/20 backdrop-blur-sm ${
        sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4'
      }`}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`w-full max-w-lg overflow-y-auto bg-surface-container-lowest p-space-lg shadow-[0_12px_36px_-4px_rgba(24,54,83,0.18)] outline-none ${
          sheet ? 'max-h-[85vh] rounded-t-2xl sm:rounded-2xl' : 'max-h-[90vh] rounded-2xl'
        }`}
      >
        <div className="mb-space-sm flex items-start justify-between gap-space-sm">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                <Icon name={icon} size={22} />
              </span>
            ) : null}
            <h2 id={titleId} className="font-headline-sm text-headline-sm text-primary">
              {title}
            </h2>
          </div>
          {showClose ? (
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high"
            >
              <Icon name="close" size={20} />
            </button>
          ) : null}
        </div>
        {description ? (
          <div id={descId} className="mb-space-md font-body-sm text-body-sm text-on-surface-variant">
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
