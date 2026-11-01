import { useId, type ReactNode } from 'react';

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  digits?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  help?: string;
  lockedReason?: string;
}) {
  const id = useId();
  const { label, value, min, max, step, unit, digits = 1, onChange, disabled, help, lockedReason } = props;
  const shown = Number.isFinite(value) ? value.toFixed(digits) : '—';
  const pct = ((value - min) / (max - min)) * 100;
  const nudge = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, value + dir * step)));
  return (
    <div className={`slider ${disabled ? 'is-disabled' : ''}`}>
      <div className="slider-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider-value">
          {shown} <span className="unit">{unit}</span>
        </output>
      </div>
      <div className="slider-row">
        <button type="button" className="nudge" aria-label={`Decrease ${label}`} onClick={() => nudge(-1)} disabled={disabled || value <= min + 1e-9}>
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={`${shown} ${unit}`}
          aria-describedby={help || (disabled && lockedReason) ? `${id}-help` : undefined}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button type="button" className="nudge" aria-label={`Increase ${label}`} onClick={() => nudge(1)} disabled={disabled || value >= max - 1e-9}>
          +
        </button>
      </div>
      <div className="slider-range" aria-hidden="true">
        <span>{min.toFixed(digits)}</span>
        <span>{max.toFixed(digits)}</span>
      </div>
      {(help || (disabled && lockedReason)) && (
        <p id={`${id}-help`} className="slider-help">
          {disabled && lockedReason ? lockedReason : help}
        </p>
      )}
    </div>
  );
}

export function Disclosure(props: {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`disclosure ${props.open ? 'is-open' : ''}`}>
      <h3 className="disclosure-h">
        <button type="button" aria-expanded={props.open} aria-controls={id} onClick={props.onToggle}>
          {props.icon && <span className="disclosure-icon" aria-hidden="true">{props.icon}</span>}
          <span className="disclosure-title">{props.title}</span>
          {props.badge}
          <span className="chev" aria-hidden="true">▾</span>
        </button>
      </h3>
      {props.open && (
        <div id={id} className="disclosure-body">
          {props.children}
        </div>
      )}
    </section>
  );
}

export function Switch(props: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className={`switch-row ${props.disabled ? 'is-disabled' : ''}`}>
      <label htmlFor={id} className="switch-label">
        <span>{props.label}</span>
        {props.hint && <small>{props.hint}</small>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        className="switch"
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
      >
        <span className="switch-knob" />
      </button>
    </div>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {!props.hideLabel && <span className="segmented-label">{props.label}</span>}
      <div className="segmented-track">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? 'is-on' : ''}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Card(props: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode; as?: 'section' | 'aside' | 'div' }) {
  const Tag = props.as ?? 'section';
  return (
    <Tag className={`card ${props.className ?? ''}`}>
      {(props.title || props.actions) && (
        <header className="card-h">
          {props.title && <h2>{props.title}</h2>}
          {props.actions && <div className="card-actions">{props.actions}</div>}
        </header>
      )}
      {props.children}
    </Tag>
  );
}

export function usePrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Soft, positive two-note chime. Only plays when the user turned sound on. */
export function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [523.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.4);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio unavailable — feedback is always visual too */
  }
}
