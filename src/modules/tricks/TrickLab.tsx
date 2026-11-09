import { useEffect, useMemo, useState } from 'react';
import { INERTIA, LANDING_TOLERANCE_DEG, simulateRotation, type RotationPlan, type RotationResult, type TrickAxis } from '../../physics/rotation';
import { fmt } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Slider, playChime, usePrefersReducedMotion } from '../../components/ui';
import { Rider } from '../../components/Rider';
import { LabHints, LabLearning } from '../labShared';

interface Trick { id: string; name: string; axis: TrickAxis; turns: number; about: string }
const TRICKS: Trick[] = [
  { id: '360', name: '360', axis: 'spin', turns: 1, about: 'One full turn about the head-to-toe axis.' },
  { id: '720', name: '720', axis: 'spin', turns: 2, about: 'Two full turns. Twice the rotation in the same airtime.' },
  { id: '1080', name: '1080', axis: 'spin', turns: 3, about: 'Three turns: a contest-level spin that needs a big jump.' },
  { id: '1440', name: '1440', axis: 'spin', turns: 4, about: 'Four turns: at the edge of what has been landed in competition.' },
  { id: 'backflip', name: 'Backflip', axis: 'flip', turns: 1, about: 'One rotation about the left–right axis.' },
  { id: 'double-backflip', name: 'Double backflip', axis: 'flip', turns: 2, about: 'Two flips. Elias Ruso landed one on Darkfest’s Falcon Heavy in 2026.' },
];
const JUMPS = [
  { id: 'dj', label: 'Dirt jump', airtime: 1.0 },
  { id: 'slope', label: 'Slopestyle booter', airtime: 1.6 },
  { id: 'falcon', label: 'Falcon Heavy', airtime: 2.7 },
];

interface Mission { id: string; text: string; check: (p: RotationPlan, r: RotationResult, trick: Trick) => boolean }
const MISSIONS: Mission[] = [
  { id: 'm1', text: 'Land a clean 360 with no tuck at all.', check: (p, r, t) => t.id === '360' && r.verdict === 'clean' && p.tuck < 0.05 },
  { id: 'm2', text: 'Land a backflip on the dirt jump (1.0 s of airtime).', check: (p, r, t) => t.id === 'backflip' && r.verdict === 'clean' && p.airtime <= 1.05 },
  { id: 'm3', text: 'Land a 720 with a takeoff snap under 400°/s. You will need the tuck.', check: (p, r, t) => t.id === '720' && r.verdict === 'clean' && p.snapDegPerS < 400 },
  { id: 'm4', text: 'Land a double backflip on the Falcon Heavy.', check: (p, r, t) => t.id === 'double-backflip' && r.verdict === 'clean' && p.airtime >= 2.5 },
];

export function TrickLab() {
  const { state, dispatch } = useStore();
  const reduced = usePrefersReducedMotion() || state.lowDistraction;
  const [trickId, setTrickId] = useState(TRICKS.some((t) => t.id === state.preset) ? state.preset! : '360');
  const trick = TRICKS.find((t) => t.id === trickId)!;
  const [airtime, setAirtime] = useState(1.6);
  const [snap, setSnap] = useState(200);
  const [tuck, setTuck] = useState(0);
  const [tuckFrom, setTuckFrom] = useState(0.15);
  const [tuckTo, setTuckTo] = useState(0.75);
  const [status, setStatus] = useState<'ready' | 'flying' | 'landed'>('ready');
  const [simT, setSimT] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const plan: RotationPlan = useMemo(() => ({ axis: trick.axis, turns: trick.turns, airtime, snapDegPerS: snap, tuck, tuckFrom, tuckTo: Math.max(tuckTo, tuckFrom + 0.1) }), [trick, airtime, snap, tuck, tuckFrom, tuckTo]);
  const res = useMemo(() => simulateRotation(plan), [plan]);

  useEffect(() => { setStatus('ready'); }, [plan]);
  useEffect(() => {
    if (status !== 'flying') return;
    const finish = () => {
      setStatus('landed');
      if (state.sound && res.verdict === 'clean') playChime();
      setDone((d) => {
        const next = { ...d };
        for (const m of MISSIONS) if (m.check(plan, res, trick)) next[m.id] = true;
        return next;
      });
    };
    if (reduced) { setSimT(airtime); finish(); return; }
    const duration = Math.min(5, Math.max(1.8, airtime / 0.5));
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / duration);
      setSimT(p * airtime);
      if (p < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sampleAt = (t: number) => res.samples[Math.min(res.samples.length - 1, Math.max(0, Math.round((t / airtime) * (res.samples.length - 1))))];
  const now = sampleAt(status === 'ready' ? 0 : status === 'landed' ? airtime : simT);
  const shown = status === 'landed';

  /* ---------- scene: the arc with a strobe of rider positions ---------- */
  const W = 760, H = 300, gy = 250, x0 = 120, x1 = 640;
  const apexPx = Math.min(185, 60 + airtime * 48);
  const pos = (t: number) => { const k = t / airtime; return { x: x0 + (x1 - x0) * k, y: gy - 4 * apexPx * k * (1 - k) }; };
  const size = 34;
  const riderProps = (t: number) => {
    const s = sampleAt(t);
    return trick.axis === 'flip' ? { flipDeg: s.angleDeg, tuck: s.tuck } : { spinDeg: s.angleDeg, tuck: s.tuck };
  };
  const strobe = Array.from({ length: 7 }, (_, i) => ((i + 0.5) / 7) * airtime);
  const p = pos(status === 'ready' ? 0 : status === 'landed' ? airtime : simT);

  /* ---------- timeline graph: spin rate and tuck ---------- */
  const GW = 760, GH = 150, gl = 46, gr = 14, gt = 14, gb = 28;
  const wMax = Math.max(400, Math.ceil(res.peakOmegaDegPerS / 200) * 200);
  const tx = (t: number) => gl + (t / airtime) * (GW - gl - gr);
  const wy = (w: number) => GH - gb - (w / wMax) * (GH - gb - gt);
  const omegaPts = res.samples.filter((_, i) => i % 4 === 0).map((s) => `${tx(s.t).toFixed(1)},${wy(s.omegaDegPerS).toFixed(1)}`).join(' ');
  const tuckA = plan.tuckFrom * airtime, tuckB = plan.tuckTo * airtime;

  const dial = (() => {
    const R = 46, cx = 60, cy = 60;
    const frac = now.angleDeg / res.targetDeg;
    const a = Math.min(frac, 1.25) * 2 * Math.PI;
    const arc = (to: number) => {
      const big = to > Math.PI ? 1 : 0;
      const ex = cx + R * Math.sin(to), ey = cy - R * Math.cos(to);
      return to >= 2 * Math.PI - 1e-3 ? `M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}` : `M${cx} ${cy - R} A${R} ${R} 0 ${big} 1 ${ex} ${ey}`;
    };
    const tol = (LANDING_TOLERANCE_DEG / res.targetDeg) * 2 * Math.PI;
    return (
      <svg viewBox="0 0 120 120" className="dial" role="img" aria-label={`Rotation so far ${fmt(now.angleDeg, 0)} of ${res.targetDeg} degrees`}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line)" strokeWidth={10} />
        <path d={`M${cx + R * Math.sin(-tol)} ${cy - R * Math.cos(-tol)} A${R} ${R} 0 0 1 ${cx + R * Math.sin(tol)} ${cy - R * Math.cos(tol)}`} fill="none" stroke="var(--target-top)" strokeWidth={10} />
        {a > 0.01 && <path d={arc(Math.min(a, 2 * Math.PI))} fill="none" stroke="var(--accent)" strokeWidth={6} strokeLinecap="round" />}
        <text x={cx} y={cy - 2} textAnchor="middle" className="dial-num">{fmt(now.angleDeg, 0)}°</text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="svg-tiny">of {res.targetDeg}°</text>
      </svg>
    );
  })();

  const verdict = { clean: { cls: 'ok', icon: '✓', title: 'Rode away clean' }, under: { cls: 'short', icon: '↺', title: 'Under-rotated' }, over: { cls: 'over', icon: '↻', title: 'Over-rotated' } }[res.verdict];
  const inertiaNow = INERTIA[trick.axis];

  return (
    <div className="lab-grid">
      <div className="lab-main">
        <section className="objective" aria-labelledby="tr-goal">
          <div className="objective-body">
            <p className="eyebrow">Trick Lab · angular momentum</p>
            <h2 id="tr-goal" className="goal">Set the spin at the lip, then use your tuck to finish the rotation exactly when the ground arrives.</h2>
          </div>
        </section>
        <section className="card scene-card" aria-label="Trick simulation">
          <div className="scene-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} className="scene lab-svg" role="img" aria-label={shown ? `${trick.name}: ${verdict.title}. Rotated ${fmt(res.totalDeg, 0)} of ${res.targetDeg} degrees.` : `${trick.name} over a jump with ${fmt(airtime, 1)} seconds of airtime.`}>
              <rect width={W} height={H} fill="var(--sky-bottom)" />
              <path d={`M0 ${gy} L${x0 - 70} ${gy} Q${x0 - 20} ${gy} ${x0} ${gy - 26} L${x0} ${H} L0 ${H}Z`} fill="var(--dirt)" />
              <path d={`M${x1 - 14} ${gy - 22} L${x1 + 90} ${gy + 30} L${W} ${gy + 30} L${W} ${H} L${x1 - 14} ${H}Z`} fill="var(--dirt)" />
              <path d={`M${x0} ${gy - 26} Q${(x0 + x1) / 2} ${gy - 26 - 2 * apexPx} ${x1} ${gy - 16}`} fill="none" stroke="var(--path)" strokeWidth={2} strokeDasharray="4 7" opacity={0.6} />
              {!state.lowDistraction && strobe.map((t) => { const q = pos(t); return <Rider key={t} x={q.x} y={q.y - 12} size={size} ghost {...riderProps(t)} />; })}
              <Rider x={p.x} y={p.y - 12} size={size} {...riderProps(status === 'ready' ? 0 : status === 'landed' ? airtime : simT)} />
              <text x={12} y={22} className="chip-text">spin rate now: {fmt(now.omegaDegPerS, 0)}°/s</text>
              <text x={W - 12} y={22} textAnchor="end" className="chip-text">airtime {fmt(airtime, 1)} s</text>
            </svg>
            <svg viewBox={`0 0 ${GW} ${GH}`} className="scene timeline" role="img" aria-label={`Spin rate over time. It starts at ${fmt(snap, 0)} degrees per second and peaks at ${fmt(res.peakOmegaDegPerS, 0)} while tucked.`}>
              {tuck > 0.02 && <rect x={tx(tuckA)} y={gt} width={tx(tuckB) - tx(tuckA)} height={GH - gb - gt} fill="var(--accent-soft)" />}
              {tuck > 0.02 && <text x={(tx(tuckA) + tx(tuckB)) / 2} y={gt + 12} textAnchor="middle" className="svg-tiny">tucked</text>}
              {[0, 0.5, 1].map((k) => (
                <g key={k}>
                  <line x1={gl} x2={GW - gr} y1={wy(wMax * k)} y2={wy(wMax * k)} stroke="var(--grid)" />
                  <text x={gl - 6} y={wy(wMax * k) + 4} textAnchor="end" className="svg-tiny">{wMax * k}</text>
                </g>
              ))}
              <polyline points={omegaPts} fill="none" stroke="var(--accent)" strokeWidth={3} />
              <line x1={tx(now.t)} x2={tx(now.t)} y1={gt} y2={GH - gb} stroke="var(--ink)" strokeWidth={1.5} />
              <circle cx={tx(now.t)} cy={wy(now.omegaDegPerS)} r={5} fill="var(--ink)" />
              <line x1={gl} x2={GW - gr} y1={GH - gb} y2={GH - gb} stroke="var(--ink)" />
              <text x={gl} y={GH - 8} className="svg-tiny">takeoff</text>
              <text x={GW - gr} y={GH - 8} textAnchor="end" className="svg-tiny">landing · time →</text>
              <text x={gl + 4} y={gt + 2} className="svg-tiny">spin rate (°/s)</text>
            </svg>
            <div className="action-bar">
              <button type="button" className="btn btn-primary btn-launch" disabled={status === 'flying'} onClick={() => { setSimT(0); setStatus('flying'); }}>{status === 'landed' ? 'Throw it again' : 'Throw it'}</button>
              <button type="button" className="btn" disabled={status === 'ready'} onClick={() => setStatus('ready')}>Reset</button>
            </div>
          </div>
        </section>

        <Card title="Plan the trick" className="controls">
          <div className="feature-chips" role="group" aria-label="Choose a trick">
            {TRICKS.map((t) => <button key={t.id} type="button" className={`pill-btn ${trickId === t.id ? 'is-on' : ''}`} aria-pressed={trickId === t.id} onClick={() => setTrickId(t.id)}>{t.name}</button>)}
          </div>
          <p className="small muted">{trick.about}</p>
          <div className="control-groups">
            <fieldset>
              <legend>Jump and takeoff</legend>
              <Slider label="Airtime" unit="s" value={airtime} min={0.6} max={3.2} step={0.1} onChange={setAirtime} />
              <div className="feature-chips" role="group" aria-label="Airtime presets">
                {JUMPS.map((j) => <button key={j.id} type="button" className={`pill-btn ${Math.abs(airtime - j.airtime) < 0.01 ? 'is-on' : ''}`} onClick={() => setAirtime(j.airtime)}>{j.label} · {j.airtime.toFixed(1)} s</button>)}
              </div>
              <Slider label="Snap off the lip" unit="°/s" digits={0} value={snap} min={60} max={900} step={5} onChange={setSnap} help="The spin rate you leave the ground with. It is the only chance to create rotation." />
            </fieldset>
            <fieldset>
              <legend>In the air</legend>
              <Slider label="Tuck tightness" unit="%" digits={0} value={tuck * 100} min={0} max={100} step={5} onChange={(v) => setTuck(v / 100)} help="Pulling in shrinks your moment of inertia." />
              <Slider label="Pull in at" unit="% of airtime" digits={0} value={tuckFrom * 100} min={0} max={70} step={5} disabled={tuck < 0.02} onChange={(v) => setTuckFrom(v / 100)} />
              <Slider label="Open up at" unit="% of airtime" digits={0} value={Math.max(tuckTo, tuckFrom + 0.1) * 100} min={20} max={100} step={5} disabled={tuck < 0.02} onChange={(v) => setTuckTo(v / 100)} help="Opening early slows the spin so you can spot the landing." />
            </fieldset>
          </div>
        </Card>
      </div>

      <aside className="lab-side">
        <Card title="Rotation" className="results">
          <div className="dial-row">
            {dial}
            <div>
              {shown ? (
                <>
                  <p className={`outcome-line ${verdict.cls}`} role="status"><span className="outcome-icon" aria-hidden="true">{verdict.icon}</span>{verdict.title}</p>
                  <p className="explain">
                    {res.verdict === 'clean' ? `Within ${LANDING_TOLERANCE_DEG}° of a perfect landing (${res.errorDeg >= 0 ? '+' : ''}${fmt(res.errorDeg, 0)}°).` : `${fmt(Math.abs(res.errorDeg), 0)}° ${res.verdict === 'under' ? 'short' : 'too far'}. Wheels need to be within ${LANDING_TOLERANCE_DEG}° to ride away.`}
                  </p>
                </>
              ) : <p className="muted">Throw the trick to see where you end up. The green band on the dial is a rideable landing.</p>}
            </div>
          </div>
          {shown && (
            <>
              <dl className="stats">
                <div><dt>Rotation achieved</dt><dd>{fmt(res.totalDeg, 0)}°</dd></div>
                <div><dt>Rotation needed</dt><dd>{res.targetDeg}°</dd></div>
                <div><dt>Peak spin rate</dt><dd>{fmt(res.peakOmegaDegPerS, 0)}°/s</dd></div>
                <div><dt>Angular momentum</dt><dd>{fmt(res.L, 1)} kg·m²/s</dd></div>
              </dl>
              {res.verdict !== 'clean' && Number.isFinite(res.idealSnapDegPerS) && (
                <p className="sample">With this tuck plan, a snap of about <strong>{fmt(res.idealSnapDegPerS, 0)}°/s</strong> would land it. Or keep the snap and change how long you stay tucked.</p>
              )}
            </>
          )}
          <p className="small muted">Moment of inertia about this axis: about {inertiaNow.open} kg·m² open, {inertiaNow.tucked} kg·m² tucked (estimates). Tucking can raise the spin rate by up to {fmt((inertiaNow.open / inertiaNow.tucked - 1) * 100, 0)}%.</p>
        </Card>

        <Card title="Missions" className="missions">
          <ul className="mission-list">
            {MISSIONS.map((m) => (
              <li key={m.id} className={done[m.id] ? 'is-done' : ''}>
                <span className="mission-box" aria-hidden="true">{done[m.id] ? '✓' : ''}</span>
                <span>{m.text}{done[m.id] && <span className="sr-only"> (completed)</span>}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'openLab', module: 'atlas', venueId: 'mont-sainte-anne' })}>Where the pros do this →</button>
        </Card>

        <LabHints hints={[
          'Rotation needed ÷ airtime gives the average spin rate you must hold. A 720 in 1.6 s needs 450°/s on average.',
          'You cannot add spin in the air. But pulling in makes the same angular momentum turn you faster.',
          'L = I·ω stays fixed. If tucking cuts I from 6 to 4.4, ω rises by 6 ÷ 4.4 ≈ 1.36 times while you hold the tuck.',
        ]} />
        <LabLearning
          equations={
            <>
              <p className="eq">L = I · ω  (constant in the air)</p>
              <p className="small">L is angular momentum, I is moment of inertia (how spread out your mass is from the axis), ω is spin rate.</p>
              <p className="eq">ω_tucked = ω_open × (I_open / I_tucked)</p>
              <p className="eq">rotation = area under the spin-rate graph</p>
              <p className="small">The graph under the scene is ω against time. Its area is the total angle you turn, just as the area under a speed graph is distance.</p>
            </>
          }
          assumptions={[
            'No air: nothing changes angular momentum between takeoff and landing.',
            'One axis at a time. Real corked and flat-spin tricks tilt the axis.',
            'Moments of inertia are estimates for a 75 kg rider on a 12 kg dirt-jump bike.',
            'A landing counts as clean within 25° either way. Real margins depend on the landing and the rider.',
          ]}
          reflection="Bigger tricks arrived as jumps got bigger. Using airtime and spin rate, explain why a 1440 is not possible on a small dirt jump no matter how strong the rider is."
        />
      </aside>
    </div>
  );
}
