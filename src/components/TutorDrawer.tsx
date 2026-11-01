import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Segmented, Switch } from './ui';
import { CHALLENGES, CONCEPTS, getChallenge } from '../modules/jump/challenges';
import { ConceptMarker } from '../modules/jump/ChallengePanels';
import { TRANSFER_CHECKS } from '../modules/jump/transfer';

export function TutorDrawer() {
  const { state, dispatch, f } = useStore();
  const ref = useRef<HTMLElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const { tutor } = state;
  const open = tutor.open;

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'tutor', patch: { open: false } });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dispatch]);

  if (!open) return null;
  const inJump = state.module === 'jump';
  const inChallenge = state.mode === 'challenge';
  const c = getChallenge(state.challengeId);
  const startKey = inChallenge ? c.id : 'explore';
  const custom = tutor.customStart[startKey];

  const reqValue = tutor.requirePrediction === null ? 'default' : tutor.requirePrediction ? 'on' : 'off';

  // Gather written responses for review
  const textItems = TRANSFER_CHECKS.flatMap((t) => t.items.filter((i) => i.kind === 'text').map((i) => ({ id: i.id, prompt: i.prompt })));
  const written = [
    ...textItems.map((t) => ({ label: t.prompt, value: state.checks[t.id]?.value ?? '' })),
    { label: 'Build an Explanation: vx and vy', value: state.answers['text:explain'] ?? '' },
    ...CHALLENGES.map((ch) => ({ label: `Reflection: ${ch.title}`, value: state.answers[`reflect:${ch.id}`] ?? '' })),
  ].filter((w) => w.value.trim());

  return (
    <aside className="tutor-drawer" aria-label="Tutor controls" tabIndex={-1} ref={ref}>
      <header className="tutor-h">
        <h2>Tutor Mode</h2>
        <button type="button" className="btn btn-icon" aria-label="Close tutor controls" onClick={() => dispatch({ type: 'tutor', patch: { open: false } })}>
          ✕
        </button>
      </header>
      <p className="small muted">Set things up before you share your screen. Nothing here is saved or sent anywhere.</p>

      {inJump ? (
        <>
          <section className="tutor-sec">
            <h3>Activity</h3>
            <label className="field">
              <span>Guided challenge</span>
              <select
                value={inChallenge ? state.challengeId : ''}
                onChange={(e) => (e.target.value ? dispatch({ type: 'selectChallenge', id: e.target.value }) : dispatch({ type: 'setMode', mode: 'explore' }))}
              >
                <option value="">Free explore (no challenge)</option>
                {CHALLENGES.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.number}. {ch.title}
                  </option>
                ))}
              </select>
            </label>
            {inChallenge && <p className="tutor-note">{c.tutorNote}</p>}
            <div className="row-actions">
              <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'resetActivity' })}>
                Reset activity to its start
              </button>
            </div>
          </section>

          <section className="tutor-sec">
            <h3>Starting values</h3>
            <p className="small">
              {custom ? 'Custom start in use: ' : 'Built-in start: '}
              {(() => {
                const s = custom ?? (inChallenge ? c.start : null);
                return s
                  ? `${f.speed(s.params.speed)}, ${s.params.angleDeg}°, ${f.length(s.params.height)} high, gap ${f.length(s.target.start)}, width ${f.length(s.target.width)}`
                  : 'default settings';
              })()}
            </p>
            <p className="small muted">Set the sliders the way you want, then save them as this activity’s start.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'setCustomStart', id: startKey, params: { ...state.params }, target: { ...state.target } })}>
                Use current sliders as start
              </button>
              {custom && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => dispatch({ type: 'clearCustomStart', id: startKey })}>
                  Restore built-in start
                </button>
              )}
            </div>
          </section>

          <section className="tutor-sec">
            <h3>Student view</h3>
            <Switch label="Equations panel available" checked={tutor.equationsAllowed} onChange={(v) => dispatch({ type: 'tutor', patch: { equationsAllowed: v } })} />
            <Switch label="Hints available" checked={tutor.hintsAllowed} onChange={(v) => dispatch({ type: 'tutor', patch: { hintsAllowed: v } })} />
            <Switch
              label="Unrestricted controls"
              hint="Off: only the sliders a challenge focuses on are unlocked"
              checked={tutor.unrestricted}
              onChange={(v) => dispatch({ type: 'tutor', patch: { unrestricted: v } })}
            />
            <Segmented
              label="Prediction before launch"
              value={reqValue}
              onChange={(v) => dispatch({ type: 'tutor', patch: { requirePrediction: v === 'default' ? null : v === 'on' } })}
              options={[
                { value: 'default', label: 'Challenge default' },
                { value: 'on', label: 'Required' },
                { value: 'off', label: 'Optional' },
              ]}
            />
          </section>

          <section className="tutor-sec">
            <h3>Saved comparisons</h3>
            <div className="row-actions">
              <button type="button" className="btn btn-small" disabled={!state.attempts.length} onClick={() => dispatch({ type: 'clearAttempts' })}>
                Clear saved attempts
              </button>
              <button type="button" className="btn btn-small" disabled={!state.clearedAttempts} onClick={() => dispatch({ type: 'restoreAttempts' })}>
                Restore cleared attempts
              </button>
            </div>
          </section>
        </>
      ) : state.module !== 'menu' ? (
        <section className="tutor-sec">
          <h3>This lab</h3>
          <Switch label="Equations panel available" checked={tutor.equationsAllowed} onChange={(v) => dispatch({ type: 'tutor', patch: { equationsAllowed: v } })} />
          <Switch label="Hints available" checked={tutor.hintsAllowed} onChange={(v) => dispatch({ type: 'tutor', patch: { hintsAllowed: v } })} />
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'resetLab' })}>
            Reset lab to its start
          </button>
        </section>
      ) : null}

      <section className="tutor-sec">
        <h3>Learning checks</h3>
        <p className="small muted">Mark independent understanding. Session only.</p>
        {CONCEPTS.map((cpt) => (
          <ConceptMarker key={cpt.id} concept={cpt.id} />
        ))}
      </section>

      <section className="tutor-sec">
        <h3>Written responses to review</h3>
        {written.length === 0 ? (
          <p className="small muted">None yet.</p>
        ) : (
          <ul className="written">
            {written.map((w, i) => (
              <li key={i}>
                <strong>{w.label}</strong>
                <p>{w.value}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tutor-sec">
        <h3>Session</h3>
        {!confirmNew ? (
          <button type="button" className="btn btn-small" onClick={() => setConfirmNew(true)}>
            Start a new student session…
          </button>
        ) : (
          <div className="confirm">
            <p className="small">This clears all attempts, answers, marks and custom starts.</p>
            <div className="row-actions">
              <button type="button" className="btn btn-small btn-primary" onClick={() => { dispatch({ type: 'newSession' }); setConfirmNew(false); }}>
                Yes, clear everything
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmNew(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}
