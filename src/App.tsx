import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { MODULES, getModule } from './modules/registry';
import { Segmented, Switch } from './components/ui';
import { TutorDrawer } from './components/TutorDrawer';

function TimerChip() {
  const { state, dispatch } = useStore();
  const { timer } = state;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);
  if (!timer.enabled) return null;
  const ms = timer.elapsed + (timer.running && timer.startedAt ? Date.now() - timer.startedAt : 0);
  const s = Math.floor(ms / 1000);
  const label = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <div className="timer-chip" role="timer" aria-label={`Elapsed time ${label}`}>
      <span aria-hidden="true">{label}</span>
      <button type="button" className="btn btn-icon btn-tiny" aria-label={timer.running ? 'Pause timer' : 'Start timer'} onClick={() => dispatch({ type: 'timer', op: timer.running ? 'pause' : 'start' })}>
        {timer.running ? 'Pause' : 'Start'}
      </button>
      <button type="button" className="btn btn-icon btn-tiny" aria-label="Reset timer" onClick={() => dispatch({ type: 'timer', op: 'reset' })}>
        ↺
      </button>
    </div>
  );
}

function SettingsMenu() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="settings" ref={ref}>
      <button type="button" className="btn btn-ghost" aria-expanded={open} aria-controls="settings-pop" onClick={() => setOpen(!open)}>
        <span className="hide-sm">Settings</span>
      </button>
      {open && (
        <div id="settings-pop" className="popover" role="group" aria-label="Settings">
          <Segmented
            label="Units"
            value={state.units}
            onChange={(u) => dispatch({ type: 'setUnits', units: u })}
            options={[
              { value: 'us', label: 'US (mph, ft)' },
              { value: 'metric', label: 'Metric (m/s, m)' },
            ]}
          />
          <Switch label="Low-distraction mode" hint="Hides scenery & grid, closes extra panels, no animation" checked={state.lowDistraction} onChange={(on) => dispatch({ type: 'setLowDistraction', on })} />
          <Switch label="Sound" hint="A soft chime on landing" checked={state.sound} onChange={(on) => dispatch({ type: 'setSound', on })} />
          <Switch label="Optional timer" hint="Counts up. Never a deadline" checked={state.timer.enabled} onChange={(on) => dispatch({ type: 'timer', op: on ? 'enable' : 'disable' })} />
        </div>
      )}
    </div>
  );
}

function Header() {
  const { state, dispatch } = useStore();
  const mod = getModule(state.module);
  return (
    <header className="app-header">
      <div className="brand">
        <button type="button" className="brand-btn" onClick={() => dispatch({ type: 'setModule', module: 'menu' })} aria-label="Mathlete MTB Physics Playground, go to module menu">
          <svg viewBox="0 0 40 28" width="40" height="28" aria-hidden="true">
            <circle cx="9" cy="19" r="7" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="31" cy="19" r="7" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M9 19 L18 8 L31 19 M18 8 L26 8 M15 19 L18 8" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
          </svg>
          <span className="brand-text">
            <strong>Mathlete</strong> <span>MTB Physics Playground</span>
          </span>
        </button>
        {mod && (
          <>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span className="crumb">{mod.title}</span>
          </>
        )}
      </div>
      <div className="header-tools">
        {mod && (
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'setModule', module: 'menu' })}>
            ☰ <span className="hide-sm">Modules</span>
          </button>
        )}
        <Segmented
          label="Units"
          hideLabel
          value={state.units}
          onChange={(u) => dispatch({ type: 'setUnits', units: u })}
          options={[
            { value: 'us', label: 'US' },
            { value: 'metric', label: 'Metric' },
          ]}
        />
        <TimerChip />
        <button type="button" className={`btn btn-ghost ${state.lowDistraction ? 'is-active' : ''}`} aria-pressed={state.lowDistraction} onClick={() => dispatch({ type: 'setLowDistraction', on: !state.lowDistraction })}>
          ◎ <span className="hide-sm">Focus mode</span>
        </button>
        <SettingsMenu />
        <button type="button" className={`btn btn-tutor ${state.tutor.open ? 'is-active' : ''}`} aria-pressed={state.tutor.open} onClick={() => dispatch({ type: 'tutor', patch: { open: !state.tutor.open } })}>
          Tutor
        </button>
      </div>
    </header>
  );
}

function ModuleCard({ m, cta }: { m: (typeof MODULES)[number]; cta: string }) {
  const { dispatch } = useStore();
  return (
    <li className={`module-card ${m.featured ? 'featured' : ''}`}>
      <button type="button" onClick={() => dispatch({ type: 'setModule', module: m.id })}>
        <span className="module-icon" aria-hidden="true">{m.icon}</span>
        <span className="module-title">{m.title}</span>
        <span className="module-tag">{m.tagline}</span>
        <span className="module-concepts">{m.concepts}</span>
        <span className="module-go" aria-hidden="true">{cta}</span>
      </button>
    </li>
  );
}

function ModuleMenu() {
  const { dispatch } = useStore();
  const tour = MODULES.find((m) => m.group === 'tour')!;
  return (
    <div className="menu">
      <section className="hero">
        <h1>The Physics Behind Your Riding</h1>
        <p>Start with the basics on a simple jump. Then take the same physics to the tracks and jumps the pros rode in 2026.</p>
      </section>

      <button type="button" className="tour-banner" onClick={() => dispatch({ type: 'setModule', module: 'atlas' })}>
        <span className="tour-banner-text">
          <span className="eyebrow">New · {tour.title}</span>
          <span className="tour-banner-title">Where in the world do you want to ride?</span>
          <span className="module-tag">{tour.tagline}</span>
          <span className="module-go" aria-hidden="true">Open the map →</span>
        </span>
        <span className="tour-banner-stats" aria-hidden="true">
          <span><strong>3:28.785</strong>Goldstone, Black Snake</span>
          <span><strong>110 ft</strong>Darkfest gap</span>
          <span><strong>94.50</strong>Godziek, Rhapsody</span>
        </span>
      </button>

      <h2 className="menu-h">Foundations</h2>
      <p className="menu-sub">One idea at a time, with predictions, hints and tutor tools.</p>
      <ul className="module-grid">
        {MODULES.filter((m) => m.group === 'foundations').map((m) => <ModuleCard key={m.id} m={m} cta={m.featured ? 'Start here →' : 'Open →'} />)}
      </ul>

      <h2 className="menu-h">Pro labs</h2>
      <p className="menu-sub">The same physics with the simplifications taken out: air, wind, slopes, spin and real race tracks.</p>
      <ul className="module-grid">
        {MODULES.filter((m) => m.group === 'pro').map((m) => <ModuleCard key={m.id} m={m} cta="Open →" />)}
      </ul>
      <p className="menu-note">An educational simulation, not a bike-design or safety tool. Nothing you do here leaves this browser tab.</p>
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  const mod = getModule(state.module);
  const Comp = mod?.Component;
  return (
    <div className={`app ${state.lowDistraction ? 'low-distraction' : ''} ${state.tutor.open ? 'tutor-open' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <Header />
      <div className="app-body">
        <main id="main" tabIndex={-1}>
          {Comp ? <Comp key={state.module === 'jump' ? 'jump' : `${state.module}-${state.labResetKey}`} /> : <ModuleMenu />}
        </main>
        <TutorDrawer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
