import { useState } from 'react';
import { G, type FlightResult, type LaunchParams } from '../../physics/projectile';
import { fmt, speedToDisplay } from '../../physics/units';
import { effectivePredictionType, useStore, type Format } from '../../state/store';
import { Card, Disclosure, Segmented, Switch } from '../../components/ui';
import { PREDICTION_QUESTIONS, actualAnswer, labelFor } from './prediction';
import { getChallenge, type PredictionType } from './challenges';

/* ================= Prediction ================= */

export function PredictionCard() {
  const { state, dispatch, d } = useStore();
  const type = effectivePredictionType(state);
  const q = PREDICTION_QUESTIONS[type];
  const last = state.current;
  const landed = state.status === 'landed' && last;
  const inChallenge = state.mode === 'challenge';
  const hasRef = state.history.some((l) => l.flight.ok);

  return (
    <Card title="Predict first" className="predict">
      <Switch
        label="Make a prediction before launching"
        hint={d.predictionRequired ? 'Required by your tutor for this activity' : 'Hides the path until you launch'}
        checked={d.predictionActive}
        disabled={d.predictionRequired}
        onChange={(on) => dispatch({ type: 'setPredictFirst', on })}
      />
      {d.predictionActive && !inChallenge && (
        <Segmented<PredictionType>
          label="Question"
          value={state.predictionType}
          onChange={(t) => dispatch({ type: 'setPredictionType', predictionType: t })}
          options={[
            { value: 'outcome', label: 'Target' },
            { value: 'distance', label: 'Distance' },
            { value: 'airtime', label: 'Air time' },
          ]}
        />
      )}
      {d.predictionActive && state.predictionType !== 'outcome' && !hasRef && (
        <p className="muted small">Comparison questions unlock after your first launch.</p>
      )}

      {d.predictionActive && !landed && (
        <fieldset className="choice-set" disabled={state.status === 'flying'}>
          <legend>{q.prompt}</legend>
          {q.options.map((o) => (
            <label key={o.value} className={`choice ${state.predictionChoice === o.value ? 'is-on' : ''}`}>
              <input
                type="radio"
                name="prediction"
                value={o.value}
                checked={state.predictionChoice === o.value}
                onChange={() => dispatch({ type: 'choosePrediction', choice: o.value })}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {landed && last.prediction && <PredictionFeedback />}
      {landed && !last.prediction && d.predictionActive && <p className="muted">This launch had no prediction. Change a setting to predict the next one.</p>}
    </Card>
  );
}

function changeSummary(f: Format, a: LaunchParams, b: LaunchParams): string {
  const parts: string[] = [];
  const arrow = (x: number, y: number) => (y > x ? '↑' : '↓');
  if (Math.abs(a.speed - b.speed) > 1e-6) parts.push(`speed ${arrow(a.speed, b.speed)} ${f.speed(a.speed)} → ${f.speed(b.speed)}`);
  if (Math.abs(a.angleDeg - b.angleDeg) > 1e-6) parts.push(`angle ${arrow(a.angleDeg, b.angleDeg)} ${fmt(a.angleDeg, 0)}° → ${fmt(b.angleDeg, 0)}°`);
  if (Math.abs(a.height - b.height) > 1e-6) parts.push(`height ${arrow(a.height, b.height)} ${f.length(a.height)} → ${f.length(b.height)}`);
  return parts.length ? parts.join('; ') : 'no launch settings changed';
}

function PredictionFeedback() {
  const { state, f } = useStore();
  const l = state.current!;
  const p = l.prediction!;
  const actual = actualAnswer(l, p.type);
  const [note, setNote] = useState('');
  if (!l.flight.ok || actual === null) {
    return <p className="feedback neutral">This configuration could not be calculated, so there is nothing to compare yet.</p>;
  }
  const match = actual === p.choice;
  let why = '';
  if (p.type === 'outcome') {
    why = 'Landing distance = vx × flight time. More speed raises both; a higher takeoff adds flight time; a steeper angle trades forward speed for upward speed.';
  } else if (l.reference && l.reference.flight.ok) {
    const before = l.reference.flight, now = l.flight;
    const what = p.type === 'distance' ? `Distance went from ${f.length(before.xLanding)} to ${f.length(now.xLanding)}.` : `Air time went from ${f.time(before.tLanding)} to ${f.time(now.tLanding)}.`;
    why = `Since your last launch: ${changeSummary(f, l.reference.params, l.params)}. ${what}`;
  }
  return (
    <div className={`feedback ${match ? 'match' : 'differ'}`} role="status">
      <p>
        <strong>You predicted:</strong> {labelFor(p.type, p.choice)}
        <br />
        <strong>Result:</strong> {labelFor(p.type, actual)}
      </p>
      <p>{match ? '✓ Your prediction matched. Can you explain why it worked?' : '◆ Different from your prediction. That’s useful information: which idea does this result test?'}</p>
      <p className="small">{why}</p>
      <label className="field">
        <span>What would you change for the next attempt, and why?</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional. Talk it through or type a few words." />
      </label>
    </div>
  );
}

/* ================= Results ================= */

export function ResultsPanel() {
  const { state, dispatch, d, f } = useStore();
  const { flight, outcome } = d;
  const t = state.target;

  let body;
  if (!d.revealed) {
    body = (
      <p className="muted">
        {state.status === 'flying' ? 'Rider in the air…' : 'Results appear after you launch, so your prediction stays a real prediction.'}
      </p>
    );
  } else if (!flight.ok || outcome.kind === 'invalid') {
    body = (
      <p className="feedback neutral" role="status">
        <strong>Unable to calculate.</strong> {flight.ok ? (outcome.kind === 'invalid' ? outcome.reason : '') : flight.reason}
      </p>
    );
  } else {
    const head = {
      inside: { icon: '✓', label: 'Inside target', cls: 'ok' },
      short: { icon: '←', label: 'Short of the target', cls: 'short' },
      overshot: { icon: '→', label: 'Beyond the target', cls: 'over' },
    }[outcome.kind];
    const explain =
      outcome.kind === 'short'
        ? `Your calculated landing point is ${f.length(outcome.by)} before the beginning of the target. The rider needs to travel farther horizontally before reaching the landing height. Try a small speed adjustment and compare the trajectory.`
        : outcome.kind === 'overshot'
          ? `The rider reaches the landing height ${f.length(outcome.by)} beyond the end of the target. Compare how launch speed and angle change the distance before choosing your next adjustment.`
          : `The rider reaches the landing height ${f.length(outcome.fromStart)} past the start of the target, with ${f.length(outcome.fromEnd)} to spare before the end. Can you find a different combination that also works?`;
    body = (
      <>
        <p className={`outcome-line ${head.cls}`} role="status" aria-live="polite">
          <span aria-hidden="true" className="outcome-icon">{head.icon}</span> {head.label}
        </p>
        <dl className="stats">
          <div><dt>Flight time</dt><dd>{f.time(flight.tLanding)}</dd></div>
          <div><dt>Landing distance</dt><dd>{f.length(flight.xLanding)}</dd></div>
          <div><dt>Horizontal velocity vx</dt><dd>{f.velocity(flight.vx)}</dd></div>
          <div><dt>Initial vertical velocity vy</dt><dd>{f.velocity(flight.vy)}</dd></div>
        </dl>
        <p className="explain">{explain}</p>
        <Disclosure title="More stats" open={state.panels.moreStats} onToggle={() => dispatch({ type: 'togglePanel', panel: 'moreStats' })}>
          <dl className="stats compact">
            <div><dt>Highest point (above landing)</dt><dd>{f.length(flight.yApex, 2)}</dd></div>
            <div><dt>Time to highest point</dt><dd>{f.time(flight.tApex)}</dd></div>
            <div><dt>Vertical velocity at landing</dt><dd>{f.velocity(flight.vyLanding)}</dd></div>
            <div><dt>Target zone</dt><dd>{f.length(t.start)} – {f.length(t.start + t.width)}</dd></div>
          </dl>
        </Disclosure>
      </>
    );
  }
  return (
    <Card title="Results" className="results">
      {body}
      <p className="disclaimer">Educational model only. It cannot tell you whether a real jump is safe.</p>
    </Card>
  );
}

/* ================= Learning ================= */

function VectorDiagram({ speed, angleDeg, f }: { speed: number; angleDeg: number; f: Format }) {
  const max = 13.4112; // 30 mph, so arrow length reflects speed
  const L = 190 * (speed / max);
  const th = (angleDeg * Math.PI) / 180;
  const ox = 34, oy = 150;
  const ex = ox + L * Math.cos(th), ey = oy - L * Math.sin(th);
  return (
    <svg viewBox="0 0 260 175" className="vector-svg" role="img" aria-label={`Velocity vector ${f.speed(speed)} at ${angleDeg} degrees, split into horizontal and vertical components.`}>
      <defs>
        {['v', 'x', 'y'].map((k) => (
          <marker key={k} id={`vh-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill={k === 'v' ? 'var(--accent)' : k === 'x' ? 'var(--vx)' : 'var(--vy)'} />
          </marker>
        ))}
      </defs>
      <line x1={ox} y1={oy} x2={250} y2={oy} stroke="var(--line)" />
      <line x1={ox} y1={oy} x2={ox} y2={8} stroke="var(--line)" />
      <line x1={ex} y1={ey} x2={ex} y2={oy} stroke="var(--ink-soft)" strokeDasharray="3 3" />
      <line x1={ex} y1={ey} x2={ox} y2={ey} stroke="var(--ink-soft)" strokeDasharray="3 3" />
      <line x1={ox} y1={oy} x2={ex} y2={oy} stroke="var(--vx)" strokeWidth={4} markerEnd="url(#vh-x)" />
      <line x1={ox} y1={oy} x2={ox} y2={ey} stroke="var(--vy)" strokeWidth={4} markerEnd="url(#vh-y)" />
      <line x1={ox} y1={oy} x2={ex} y2={ey} stroke="var(--accent)" strokeWidth={4} markerEnd="url(#vh-v)" />
      <text x={(ox + ex) / 2} y={oy + 16} textAnchor="middle" className="svg-small" fill="var(--vx)">vx</text>
      <text x={ox - 6} y={(oy + ey) / 2} textAnchor="end" className="svg-small" fill="var(--vy)">vy</text>
      <text x={(ox + ex) / 2 + 8} y={(oy + ey) / 2 - 6} className="svg-small" fill="var(--accent)">v₀</text>
      <text x={ox + 26} y={oy - 5} className="svg-small">θ</text>
    </svg>
  );
}

function Steps({ f, params, flight, revealed }: { f: Format; params: LaunchParams; flight: FlightResult; revealed: boolean }) {
  const { state } = useStore();
  const us = state.units === 'us';
  if (!flight.ok) return <p className="muted">Unable to calculate with the current settings.</p>;
  const n = (v: number, dgt = 2) => fmt(v, dgt);
  const disc = flight.vy ** 2 + 2 * G * params.height;
  const hidden = <span className="muted">(revealed after launch)</span>;
  const t = state.target;
  return (
    <ol className="steps">
      <li>
        <strong>Convert speed to m/s.</strong>{' '}
        {us ? <>v₀ = {n(speedToDisplay(params.speed, 'us'), 1)} mph × 0.44704 = {n(params.speed)} m/s.</> : <>Already in m/s: v₀ = {n(params.speed)} m/s.</>}
        {us && <> Height h = {f.length(params.height, 1)} × 0.3048 = {n(params.height)} m.</>}
      </li>
      <li>
        <strong>Split the velocity.</strong> vx = {n(params.speed)} × cos {n(params.angleDeg, 0)}° = {n(flight.vx)} m/s; vy = {n(params.speed)} × sin {n(params.angleDeg, 0)}° = {n(flight.vy)} m/s.
      </li>
      <li>
        <strong>Find when y = 0 (descending).</strong> t = (vy + √(vy² + 2·g·h)) / g{' '}
        {revealed ? <>= ({n(flight.vy)} + √{n(disc)}) / 9.81 = {n(flight.tLanding)} s.</> : hidden}
      </li>
      <li>
        <strong>Horizontal distance.</strong> x = vx × t {revealed ? <>= {n(flight.vx)} × {n(flight.tLanding)} = {n(flight.xLanding)} m{us && <> = {f.length(flight.xLanding)}</>}.</> : hidden}
      </li>
      <li>
        <strong>Compare with the target.</strong> Target runs from {f.length(t.start)} to {f.length(t.start + t.width)}. {revealed ? <>Landing at {f.length(flight.xLanding)}.</> : hidden}
      </li>
    </ol>
  );
}

export function LearningPanel() {
  const { state, dispatch, d, f } = useStore();
  const { params, panels, tutor } = state;
  const flight = d.flight;
  const toggle = (panel: keyof typeof panels) => () => dispatch({ type: 'togglePanel', panel });

  return (
    <Card title="Learn the physics" className="learning">
      <Disclosure title="Velocity vectors" icon="↗" open={panels.vectors} onToggle={toggle('vectors')}>
        {flight.ok ? (
          <div className="vectors">
            <VectorDiagram speed={params.speed} angleDeg={params.angleDeg} f={f} />
            <dl className="stats compact">
              <div><dt>Total launch velocity v₀</dt><dd>{f.speed(params.speed)}{state.units === 'us' && <> = {f.velocity(params.speed)}</>}</dd></div>
              <div><dt><span className="key vx" /> vx = v₀ · cos θ</dt><dd>{f.velocity(flight.vx)}</dd></div>
              <div><dt><span className="key vy" /> vy = v₀ · sin θ</dt><dd>{f.velocity(flight.vy)}</dd></div>
            </dl>
            <p className="small">Same speed, different angle → the speed is shared differently between forward (vx) and upward (vy).</p>
          </div>
        ) : (
          <p className="muted">Unable to calculate with the current settings.</p>
        )}
      </Disclosure>

      {tutor.equationsAllowed ? (
        <Disclosure title="Explore the physics" icon="ƒ" open={panels.physics} onToggle={toggle('physics')}>
          <div className="equations">
            <p className="eq">vx = v₀ · cos θ</p>
            <p className="eq">vy = v₀ · sin θ</p>
            <p className="eq">x(t) = vx · t</p>
            <p className="eq">y(t) = h + vy · t − ½ · g · t²</p>
            <dl className="glossary">
              <div><dt>v₀</dt><dd>launch speed (how fast the rider leaves the lip)</dd></div>
              <div><dt>θ</dt><dd>effective launch angle (direction of motion at takeoff)</dd></div>
              <div><dt>vx, vy</dt><dd>forward and upward parts of the launch velocity</dd></div>
              <div><dt>h</dt><dd>takeoff height above the landing surface</dd></div>
              <div><dt>g</dt><dd>gravity, 9.81 m/s² ({f.L.g}), always pulling down</dd></div>
              <div><dt>t</dt><dd>time since takeoff, in seconds</dd></div>
              <div><dt>x, y</dt><dd>horizontal distance from the lip, and height above the landing</dd></div>
            </dl>
            <p className="small">y(t) is a <strong>quadratic</strong> in t. That’s why the path is a parabola.</p>
            <Switch label="Step-by-step calculation" checked={panels.steps} onChange={(on) => dispatch({ type: 'togglePanel', panel: 'steps', open: on })} />
            {panels.steps && <Steps f={f} params={params} flight={flight} revealed={d.revealed} />}
          </div>
        </Disclosure>
      ) : (
        <p className="muted small locked-note">Equations are hidden for this activity.</p>
      )}

      <Disclosure title="Model assumptions" icon="ⓘ" open={panels.assumptions} onToggle={toggle('assumptions')}>
        <ul className="assumptions">
          <li>The rider is a single point; posture and bike size are ignored.</li>
          <li>Gravity is constant (9.81 m/s²). No air resistance, pedaling, or braking in the air.</li>
          <li>Landing is flat, at height 0. Real landings are slopes, and real terrain varies.</li>
          <li>Not modeled: suspension, pumping the lip, rotation, wind, tire grip.</li>
          <li>This is a learning tool. Its numbers can’t certify that a real jump is safe.</li>
        </ul>
      </Disclosure>
    </Card>
  );
}

/* ================= Hints ================= */

const EXPLORE_HINTS: [string, string, string] = [
  'Every jump is decided by three takeoff settings: speed, angle, and height. The target only decides success.',
  'Change one setting at a time and save attempts so you can compare paths side by side.',
  'Distance = vx × flight time. Speed increases both; height increases flight time; angle shifts speed between vx and vy.',
];

export function HintsCard() {
  const { state, dispatch } = useStore();
  if (!state.tutor.hintsAllowed) return null;
  const hints = state.mode === 'challenge' ? getChallenge(state.challengeId).hints : EXPLORE_HINTS;
  const lvl = state.hintLevel;
  const labels = ['Reminder', 'Clue', 'Worked step'];
  return (
    <Card title="Hints" className="hints">
      {lvl === 0 && <p className="muted small">Stuck? Hints get more specific each time.</p>}
      <ol className="hint-list" aria-live="polite">
        {hints.slice(0, lvl).map((h, i) => (
          <li key={i}>
            <span className="hint-tag">{labels[i]}</span> {h}
          </li>
        ))}
      </ol>
      <div className="row-actions">
        <button type="button" className="btn btn-small" disabled={lvl >= 3} onClick={() => dispatch({ type: 'nextHint' })}>
          {lvl === 0 ? 'Show a hint' : lvl < 3 ? `Next hint (${lvl + 1} of 3)` : 'All hints shown'}
        </button>
        {lvl > 0 && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => dispatch({ type: 'resetHints' })}>
            Hide hints
          </button>
        )}
      </div>
    </Card>
  );
}
