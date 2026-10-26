/** Calme mark: a soft drop over a calm wave (replaces the Stitch logo image, which is not publicly accessible). */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" fill="#183653" />
      <path d="M32 14c-6 7-9 13-9 19a9 9 0 0 0 18 0c0-6-3-12-9-19z" fill="#a2eee0" />
      <path d="M14 40c6-4 12-4 18 0s12 4 18 0" fill="none" stroke="#f8f9ff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
