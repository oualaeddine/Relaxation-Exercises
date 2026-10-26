import { useId, useState } from 'react';
import { normalizeConfig, optionList, rangeOf } from '../domain/config';
import { PMR_GROUPS, type Exercise } from '../domain/exercises';
import { formatMinutesLabel } from '../domain/format';
import type { ExerciseConfig, PmrPreset } from '../domain/types';
import { PMR_PRESETS, alternateCycleCount, buildSequencePlan, estimatePlanMs } from '../engine/plan';
import { ChoiceGroup, Stepper, Switch } from '../ui/controls';
import { Icon } from '../ui/Icon';

interface ConfigFormProps {
  exercise: Exercise;
  config: ExerciseConfig;
  onChange: (config: ExerciseConfig) => void;
  /** During a session some options are locked (e.g. durations shorter than the elapsed time). */
  minDurationSec?: number;
  /** Units (muscle groups) that can no longer be changed (current or past). */
  lockedUnits?: readonly string[];
  inSession?: boolean;
}

function DurationChoices({ exercise, config, onChange, minDurationSec = 0 }: ConfigFormProps) {
  const options = exercise.options;
  const custom = options.customDuration;
  const preset = options.durations ?? [];
  const [customMode, setCustomMode] = useState(custom !== undefined && !preset.includes(config.durationSec));
  const isCustom = custom !== undefined && (customMode || !preset.includes(config.durationSec));
  const [customMinutes, setCustomMinutes] = useState(String(Math.round(config.durationSec / 60)));
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const label = exercise.id === 'marche-attentive' || exercise.id === 'scan-corporel' ? "Durée de l'exercice" : 'Durée de la séance';

  const choices = preset.map((sec) => ({
    value: sec,
    label: formatMinutesLabel(sec),
    sublabel:
      exercise.id === 'respiration-alternee'
        ? `${alternateCycleCount({ ...config, durationSec: sec })} cycles`
        : sec === exercise.defaults.durationSec
          ? 'conseillé'
          : undefined,
    disabled: sec <= minDurationSec,
  }));
  const all = custom ? [...choices, { value: -1, label: 'Personnalisé', sublabel: undefined, disabled: false }] : choices;

  return (
    <div className="space-y-2">
      <ChoiceGroup<number>
        label={label}
        value={isCustom ? -1 : config.durationSec}
        options={all}
        columns={all.length === 4 ? 4 : 3}
        variant="tile"
        onChange={(value) => {
          if (value === -1) {
            setCustomMode(true);
            setCustomMinutes(String(Math.round(config.durationSec / 60)));
          } else {
            setCustomMode(false);
            setError(null);
            onChange({ ...config, durationSec: value });
          }
        }}
      />
      {isCustom && custom ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low p-3">
          <label htmlFor={inputId} className="font-label-lg text-label-lg text-primary">
            Durée personnalisée (minutes)
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={custom.min / 60}
            max={custom.max / 60}
            value={customMinutes}
            aria-invalid={error !== null}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(event) => {
              setCustomMinutes(event.target.value);
              const minutes = Number(event.target.value);
              if (!Number.isInteger(minutes) || minutes * 60 < custom.min || minutes * 60 > custom.max) {
                setError(`Saisissez un nombre entier de minutes entre ${custom.min / 60} et ${custom.max / 60}.`);
                return;
              }
              if (minutes * 60 <= minDurationSec) {
                setError('Choisissez une durée supérieure au temps déjà pratiqué.');
                return;
              }
              setError(null);
              onChange({ ...config, durationSec: minutes * 60 });
            }}
            className="h-12 w-24 rounded-2xl border border-mineral bg-surface-container-lowest px-3 text-center font-label-lg text-label-lg focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="w-full font-body-sm text-body-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SecondsChoice({
  label,
  description,
  value,
  allowed,
  defaultValue,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  allowed: readonly number[] | { min: number; max: number } | undefined;
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  if (!allowed) return null;
  if (!Array.isArray(allowed)) {
    const range = rangeOf(allowed)!;
    return <Stepper label={label} description={description} value={value} min={range.min} max={range.max} format={(v) => `${v}s`} onChange={onChange} />;
  }
  return (
    <div className="space-y-1">
      <ChoiceGroup<number>
        label={`${label} — ${value} secondes`}
        value={value}
        columns={allowed.length >= 4 ? 4 : allowed.length === 2 ? 2 : 3}
        options={optionList(allowed).map((v) => ({ value: v, label: v === defaultValue ? `${v}s (défaut)` : `${v}s` }))}
        onChange={onChange}
      />
      {description ? <p className="font-body-sm text-body-sm text-on-surface-variant">{description}</p> : null}
    </div>
  );
}

export function ConfigForm(props: ConfigFormProps) {
  const { exercise, config, onChange, lockedUnits = [], inSession = false } = props;
  const o = exercise.options;
  const d = exercise.defaults;
  const set = (patch: Partial<ExerciseConfig>) => onChange(normalizeConfig(exercise, { ...config, ...patch }));

  return (
    <div className="space-y-5">
      {o.durations ? <DurationChoices {...props} /> : null}

      {exercise.protocol === 'paced' ? (
        <>
          <SecondsChoice
            label={exercise.id === 'expiration-levres-pincees' ? 'Inspiration nasale' : "Durée d'inspiration"}
            description={exercise.id === 'expiration-levres-pincees' ? 'Respiration calme et silencieuse par les narines.' : undefined}
            value={config.inhaleSec}
            allowed={o.inhale}
            defaultValue={d.inhaleSec}
            onChange={(v) => set({ inhaleSec: v })}
          />
          {exercise.id === 'respiration-carree' ? (
            <div className="space-y-2">
              <Switch
                label="Pause poumons pleins"
                description="Suspension douce, sans fermer la gorge. Désactivée par défaut."
                checked={config.holdInEnabled}
                onChange={(v) => set({ holdInEnabled: v })}
              />
              {config.holdInEnabled ? (
                <Stepper label="Durée de la pause haute" value={config.holdInSec} min={2} max={8} format={(v) => `${v}s`} onChange={(v) => set({ holdInSec: v })} />
              ) : null}
            </div>
          ) : null}
          <SecondsChoice
            label={exercise.id === 'expiration-levres-pincees' ? 'Expiration lèvres pincées' : "Durée d'expiration"}
            description={exercise.id === 'expiration-levres-pincees' ? "L'expiration dure environ le double de l'inspiration." : undefined}
            value={config.exhaleSec}
            allowed={o.exhale}
            defaultValue={d.exhaleSec}
            onChange={(v) => set({ exhaleSec: v })}
          />
          {exercise.id === 'respiration-carree' ? (
            <div className="space-y-2">
              <Switch
                label="Pause poumons vides"
                description="Repos neutre sans contraction. Désactivée par défaut."
                checked={config.holdOutEnabled}
                onChange={(v) => set({ holdOutEnabled: v })}
              />
              {config.holdOutEnabled ? (
                <Stepper label="Durée de la pause basse" value={config.holdOutSec} min={2} max={8} format={(v) => `${v}s`} onChange={(v) => set({ holdOutSec: v })} />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {o.repetitions && !Array.isArray(o.repetitions) ? (
        <Stepper
          label="Nombre de répétitions"
          description={`${rangeOf(o.repetitions)!.min} à ${rangeOf(o.repetitions)!.max} cycles recommandés`}
          value={config.repetitions}
          min={rangeOf(o.repetitions)!.min}
          max={rangeOf(o.repetitions)!.max}
          onChange={(v) => set({ repetitions: v })}
        />
      ) : null}
      {o.repetitions && Array.isArray(o.repetitions) ? (
        <ChoiceGroup<number>
          label="Objectif de répétitions"
          value={config.repetitions}
          columns={4}
          options={o.repetitions.map((v) => ({ value: v, label: v === 5 ? '5 max' : `${v} fois` }))}
          onChange={(v) => set({ repetitions: v })}
        />
      ) : null}
      {o.secondInhale ? (
        <Switch
          label="Seconde inspiration d'appoint"
          description="Ajoute un court complément d'air, sans forcer."
          checked={config.secondInhale}
          onChange={(v) => set({ secondInhale: v })}
        />
      ) : null}
      {o.autoPace ? (
        <Switch
          label={exercise.id === 'expiration-fredonnement' ? 'Défilement doux automatique' : 'Rythme guidé automatique'}
          description={
            exercise.id === 'expiration-fredonnement'
              ? 'Rythme suggéré : 3s inspire / 8s fredonne. Désactivé : vous validez chaque répétition.'
              : exercise.id === 'respiration-alternee'
                ? 'Étapes cadencées (4s inspire / 6s expire). Désactivé : vous avancez à votre rythme.'
                : 'Étapes cadencées. Désactivé : bouton « Étape suivante ».'
          }
          checked={config.autoPace}
          onChange={(v) => set({ autoPace: v })}
        />
      ) : null}

      {o.pmrPresets ? (
        <>
          <ChoiceGroup<PmrPreset>
            label="Durée totale"
            value={config.pmrPreset}
            variant="tile"
            options={(Object.keys(PMR_PRESETS) as PmrPreset[]).map((preset) => {
              const ms = estimatePlanMs(buildSequencePlan('relaxation-musculaire', { ...config, pmrPreset: preset }), config.excludedUnits);
              return {
                value: preset,
                label: `≈ ${Math.max(1, Math.round(ms / 60_000))} min`,
                sublabel: `${PMR_PRESETS[preset].rounds} cycles / zone${preset === 'standard' ? ' · conseillé' : ''}`,
                disabled: inSession && preset !== config.pmrPreset,
              };
            })}
            onChange={(v) => set({ pmrPreset: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3.5">
              <span className="mb-1 flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                <Icon name="compress" size={16} className="text-secondary" />
                Contraction
              </span>
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">5s</span>
              <span className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">Tension très douce</span>
            </div>
            <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3.5">
              <span className="mb-1 flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                <Icon name="air" size={16} className="text-secondary" />
                Relâchement
              </span>
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">10s</span>
              <span className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">Détente profonde</span>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 font-label-lg text-label-lg text-primary">Zones corporelles</legend>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Décochez les zones sensibles ou douloureuses : elles seront passées automatiquement.</p>
            {PMR_GROUPS.map((group, index) => {
              const checked = !config.excludedUnits.includes(group.key);
              const locked = lockedUnits.includes(group.key);
              const lastOne = checked && config.excludedUnits.length >= PMR_GROUPS.length - 1;
              return (
                <label
                  key={group.key}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3.5 transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-secondary ${
                    checked ? 'bg-surface-container-low hover:bg-surface-container' : 'bg-surface-container-low/60 opacity-75'
                  } ${locked ? 'cursor-not-allowed' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-secondary">
                      <Icon name={group.icon ?? 'spa'} size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className={`block font-label-lg text-label-lg ${checked ? 'text-primary' : 'text-on-surface-variant line-through'}`}>
                        {index + 1}. {group.title}
                      </span>
                      <span className="block font-body-sm text-body-sm text-on-surface-variant">{group.hint}</span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-6 w-6 shrink-0 cursor-pointer accent-secondary"
                    checked={checked}
                    disabled={locked || lastOne}
                    aria-label={`Inclure : ${group.title}`}
                    onChange={(event) => {
                      const excluded = event.target.checked
                        ? config.excludedUnits.filter((k) => k !== group.key)
                        : [...config.excludedUnits, group.key];
                      set({ excludedUnits: excluded });
                    }}
                  />
                </label>
              );
            })}
          </fieldset>
        </>
      ) : null}

      {exercise.id === 'ancrage-sensoriel' ? (
        <p className="rounded-xl bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface-variant">
          Aucun réglage nécessaire : il n’y a aucun compte à rebours, vous avancez à votre rythme.
        </p>
      ) : null}
    </div>
  );
}
