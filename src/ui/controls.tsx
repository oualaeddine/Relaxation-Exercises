import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
}

/** Labelled switch (role="switch"), styled after the Stitch "peer" toggles. */
export function Switch({ checked, onChange, label, description, icon, disabled, className = '' }: SwitchProps) {
  const labelId = useId();
  const descId = useId();
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl bg-surface-bright p-3 transition-colors hover:bg-surface-container-low ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3 pr-2">
        {icon ? <Icon name={icon} size={22} className="mt-0.5 text-secondary" /> : null}
        <div className="min-w-0">
          <span id={labelId} className="block font-label-lg text-label-lg leading-tight text-on-surface">
            {label}
          </span>
          {description ? (
            <span id={descId} className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${
          checked ? 'bg-secondary' : 'bg-outline'
        }`}
      >
        <span
          className={`h-6 w-6 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
        <span className="sr-only">{checked ? 'Activé' : 'Désactivé'}</span>
      </button>
    </div>
  );
}

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  sublabel?: ReactNode;
  disabled?: boolean;
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Visual style: pill chips (default) or rounded tiles. */
  variant?: 'pill' | 'tile';
  columns?: 2 | 3 | 4;
  hideLabel?: boolean;
  className?: string;
}

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 xs:grid-cols-4' } as const;

/** Single-choice group (radio semantics) rendered as Calme pills. */
export function ChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  variant = 'pill',
  columns = 3,
  hideLabel = false,
  className = '',
}: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <fieldset className={`space-y-2 ${className}`}>
      <legend className={hideLabel ? 'sr-only' : 'mb-2 block font-label-md text-label-md text-on-surface-variant'}>{label}</legend>
      <div className={`grid gap-2 ${COLUMNS[columns]}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={`relative flex min-h-[44px] cursor-pointer flex-col items-center justify-center px-2 py-2.5 text-center font-label-md text-label-md transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-secondary ${
                variant === 'pill' ? 'rounded-full' : 'rounded-xl'
              } ${
                selected
                  ? 'bg-secondary-container font-semibold text-on-secondary-container shadow-sm'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
              } ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
              />
              <span>{option.label}</span>
              {option.sublabel ? (
                <span className={`text-[11px] ${selected ? 'text-on-secondary-container' : 'text-on-surface-variant'}`}>
                  {option.sublabel}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  description?: ReactNode;
  disabled?: boolean;
}

/** −/+ stepper with an accessible live value. */
export function Stepper({ label, value, min, max, onChange, format = String, description, disabled }: StepperProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
      <div className="min-w-0">
        <span id={id} className="block font-label-lg text-label-lg text-primary">
          {label}
        </span>
        {description ? <span className="block font-label-sm text-label-sm text-on-surface-variant">{description}</span> : null}
      </div>
      <div className="flex items-center gap-1 rounded-full bg-surface-container-lowest px-1 py-1 shadow-sm" role="group" aria-labelledby={id}>
        <button
          type="button"
          aria-label={`Diminuer : ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-surface-container disabled:opacity-40"
        >
          <Icon name="remove" size={18} />
        </button>
        <output aria-live="polite" className="w-10 text-center font-label-lg text-label-lg font-bold text-primary tabular-nums">
          {format(value)}
        </output>
        <button
          type="button"
          aria-label={`Augmenter : ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-surface-container disabled:opacity-40"
        >
          <Icon name="add" size={18} />
        </button>
      </div>
    </div>
  );
}

/** Small surface card used throughout the app. */
export function Card({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Record<string, unknown>) {
  return (
    <Tag className={`rounded-2xl bg-surface-container-lowest p-5 shadow-sm ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function SafetyNote({ title = 'Conseils de sécurité & écoute du corps', children }: { title?: string; children: ReactNode }) {
  return (
    <aside
      aria-label={title}
      className="flex items-start gap-space-sm rounded-2xl bg-surface-container-low p-space-md text-on-surface-variant shadow-sm"
    >
      <Icon name="info" size={22} className="mt-0.5 text-primary" />
      <div className="flex flex-col gap-1">
        <span className="font-label-md text-label-md font-semibold text-primary">{title}</span>
        <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{children}</p>
      </div>
    </aside>
  );
}
