import { ICONS, type IconName } from './icons.generated';

interface IconProps {
  name: IconName;
  /** Pixel size (Material Symbols are square). */
  size?: number;
  filled?: boolean;
  className?: string;
  /** Accessible label; icons are decorative (aria-hidden) unless a label is given. */
  label?: string;
}

/** Material Symbols (outlined, weight 400) rendered as inline SVG — no icon font download. */
export function Icon({ name, size = 24, filled = false, className = '', label }: IconProps) {
  const icon = ICONS[name] as { d: string; fill?: string };
  const d = filled && icon.fill ? icon.fill : icon.d;
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export type { IconName };
