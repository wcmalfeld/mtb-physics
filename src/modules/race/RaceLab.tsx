import { useEffect, useMemo, useState } from 'react';
import { formatClock, simulateRun, type RunResult, type RunSetup } from '../../physics/descent';
import { airDensity, localGravity } from '../../physics/atmosphere';
import { fmt, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Segmented, Slider, playChime, usePrefersReducedMotion } from '../../components/ui';
import { LabHints, LabLearning } from '../labShared';
import { CONDITIONS, RIDER_PRESETS, TRACKS, getTrack, type ConditionId, type RiderPresetId } from '../../data/tracks';
import { getVenue } from '../../data/venues';

type Posture = 'tuck' | 'attack' | 'upright';
const CDA: Record<Posture, number> = { tuck: 0.38, attack: 0.45, upright: 0.6 };
const SPEED_STEPS = 5;

interface Experiment { id: string; label: string; change: string; apply: (s: RunSetup) => RunSetup; why: string }
const EXPERIMENTS: Experiment[] = [
  {
    id: 'mass', label: 'Heavier rider', change: 'Add 15 kg (33 lb) to the rider.',
    apply: (s) => ({ ...s, mass: s.mass + 15 }),
    why: 'Gravity’s pull and tire grip both scale with mass, so in corners and braking zones mass cancels out. Air drag does not scale with mass, so a heavier rider loses less speed to the air, but also gains less from each pedal stroke. The two nearly cancel on a track this twisty.',
  },
  {
    id: 'mud', label: 'Rain', change: 'Drop the grip to wet roots and mud (μ = 0.55).',
    apply: (s) => ({ ...s, mu: CONDITIONS.mud.mu }),
    why: 'Corner speed goes with the square root of grip, and braking distances stretch in direct proportion as grip falls. Every corner gets slower and every braking zone starts earlier.',
  },
  {
    id: 'brake', label: 'Brake later', change: 'Use 100% of the available braking grip.',
    apply: (s) => ({ ...s, brakeUse: 1 }),
    why: 'Braking harder means braking later, so more of each straight is spent at full speed. The gain is real but limited: the corner speeds themselves have not changed.',
  },
  {
    id: 'tuck', label: 'Skinsuit tuck', change: 'Cut the drag area by a quarter.',
    apply: (s) => ({ ...s, cda: s.cda * 0.75 }),
    why: 'Drag grows with speed squared, so it only matters on the fast, open sections. On a track where corners set the pace, the air takes a small share of the energy.',
  },
];
type Guess = 'faster' | 'same' | 'slower';

export function RaceLab() {
  const { state, dispatch, f } = useStore();
  const u = state.units;
  const us = u === 'us';
  const reduced = usePrefersReducedMotion() || state.lowDistraction;

  const [trackId, setTrackId] = useState(getTrack(state.preset ?? undefined).id);
  const track = getTrack(trackId);
  const venue = getVenue(track.venueId);
  const [presetId, setPresetId] = useState<RiderPresetId | 'custom'>('elite');
  const [cornerUse, setCornerUse] = useState<number>(RIDER_PRESETS.elite.cornerUse);
  const [brakeUse, setBrakeUse] = useState<number>(RIDER_PRESETS.elite.brakeUse);
  const [power, setPower] = useState<number>(RIDER_PRESETS.elite.power);
  const [mass, setMass] = useState(92);
  const [posture, setPosture] = useState<Posture>('attack');
  const [cond, setCond] = useState<ConditionId>('dry');
  const [status, setStatus] = useState<'ready' | 'running' | 'done'>('ready');
  const [simT, setSimT] = useState(0);
  const [baseline, setBaseline] = useState<{ label: string; trackId: string; run: RunResult } | null>(null);
  const [tests, setTests] = useState<Record<string, { guess: Guess | null; shown: boolean }>>({});

  const setup: RunSetup = useMemo(() => ({
    mass, cda: CDA[posture], mu: CONDITIONS[cond].mu, cornerUse, brakeUse, power,
    rho: airDensity(track.finishAltitude + track.drop / 2),
    g: venue ? localGravity(venue.lat, track.finishAltitude + track.drop / 2) : 9.81,
  }), [mass, posture, cond, cornerUse, brakeUse, power, track, venue]);
  const run = useMemo(() => simulateRun(track, setup), [track, setup]);

  useEffect(() => { setStatus('ready'); setSimT(0); setTests({}); }, [setup, track]);

  useEffect(() => {
    if (status !== 'running') return;
    if (reduced) { setSimT(run.time); setStatus('done'); return; }
    const duration = 9;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / duration);
      setSimT(p * run.time);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setStatus('done'); if (state.sound) playChime(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (id: RiderPresetId) => {
    const p = RIDER_PRESETS[id];
    setPresetId(id); setCornerUse(p.cornerUse); setBrakeUse(p.brakeUse); setPower(p.power);
  };
  const custom = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPresetId('custom'); };

  /* ---------- scene geometry ---------- */
  const W = 760, H = 430, pl = 44, pr = 14;
  const top = 46, profH = 170, brakeY = top + profH + 8, spTop = brakeY + 34, spH = 110;
  const pts = run.points;
  const L = pts.length - 1;
  const sx = (s: number) => pl + (s / L) * (W - pl - pr);
  const hy = (h: number) => top + (1 - h / track.drop) * profH;
  const vTop = Math.max(10, Math.ceil(run.topSpeed / 5) * 5);
  const vy = (v: number) => spTop + spH - (v / vTop) * spH;
  const bucket = (v: number) => Math.min(SPEED_STEPS, Math.max(1, Math.ceil((v / vTop) * SPEED_STEPS)));

  const drawn = useMemo(() => {
    // profile split into runs of equal speed bucket; braking as merged spans; section boundaries
    const segs: { b: number; d: string }[] = [];
    const brakes: [number, number][] = [];
    const bounds: number[] = [];
    let cur = -1, d = '', bStart = -1;
    const step = 4;
    for (let i = 0; i <= L; i += step) {
      const p = pts[Math.min(i, L)];
      const b = bucket(p.v);
      const xy = `${sx(p.s).toFixed(1)} ${hy(p.h).toFixed(1)}`;
      if (b !== cur) { if (d) segs.push({ b: cur, d: `${d} L${xy}` }); d = `M${xy}`; cur = b; } else d += ` L${xy}`;
      if (p.braking && bStart < 0) bStart = p.s;
      if (!p.braking && bStart >= 0) { brakes.push([bStart, p.s]); bStart = -1; }
    }
    if (d) segs.push({ b: cur, d });
    if (bStart >= 0) brakes.push([bStart, L]);
    for (let i = 1; i <= L; i++) if (pts[i].section !== pts[i - 1].section) bounds.push(i);
    const area = `M${sx(0)} ${hy(track.drop)} ${pts.filter((_, i) => i % step === 0 || i === L).map((p) => `L${sx(p.s).toFixed(1)} ${hy(p.h).toFixed(1)}`).join(' ')} L${sx(L)} ${top + profH + 4} L${sx(0)} ${top + profH + 4}Z`;
    const speed = pts.filter((_, i) => i % 2 === 0 || i === L).map((p) => `${sx(p.s).toFixed(1)},${vy(p.v).toFixed(1)}`).join(' ');
    return { segs, brakes, bounds, area, speed };
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps

  const atTime = (t: number) => {
    let lo = 0, hi = L;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].t < t) lo = mid + 1; else hi = mid; }
    return pts[lo];
  };
  const ref = track.reference[0];
  const tNow = status === 'ready' ? 0 : status === 'done' ? run.time : simT;
  const me = atTime(tNow);
  const ghost = atTime(Math.min(run.time, tNow * (run.time / ref.seconds)));
  const finished = status === 'done';
  const delta = run.time - ref.seconds;
  const e = run.energy;
  const eIn = e.potential + e.pedal;
  const budget = [
    { key: 'brakes', label: 'Brakes (heat)', j: e.brakes, color: 'var(--accent)' },
    { key: 'rolling', label: 'Rough ground, tires, suspension', j: e.rolling, color: 'var(--trail)' },
    { key: 'drag', label: 'Air drag', j: e.drag, color: 'var(--info)' },
    { key: 'ke', label: 'Still moving at the finish', j: e.kineticAtFinish, color: 'var(--ok)' },
  ];
  const litres = e.brakes / (4186 * 80);
  const sectionBounds = [0, ...drawn.bounds, L];
  const baseOk = baseline && baseline.trackId === track.id ? baseline : null;

  const scene = (
    <div className="scene-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="scene" role="img" aria-label={`${track.name} elevation profile, ${f.length(track.length, 0)} long with ${f.length(track.drop, 0)} of drop. ${finished ? `Simulated time ${formatClock(run.time)}.` : ''}`}>
        <rect width={W} height={H} fill="var(--sky-bottom)" />
        {sectionBounds.slice(0, -1).map((b, i) => (
          <g key={b}>
            {i > 0 && <line x1={sx(b)} x2={sx(b)} y1={top - 6} y2={spTop + spH} stroke="var(--grid-major)" strokeDasharray="3 5" />}
            <text x={(sx(b) + sx(sectionBounds[i + 1])) / 2} y={top - 10} textAnchor="middle" className="svg-tiny section-num">{i + 1}</text>
          </g>
        ))}
        <path d={drawn.area} fill="var(--dirt)" opacity={0.55} />
        {drawn.segs.map((s, i) => <path key={i} d={s.d} fill="none" stroke={`var(--spd-${s.b})`} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />)}
        <text x={pl} y={top + 12} className="svg-tiny">start · {f.length(track.drop, 0)} above the finish</text>
        {/* braking strip */}
        <rect x={pl} y={brakeY} width={W - pl - pr} height={8} rx={4} fill="var(--panel)" stroke="var(--line)" />
        {drawn.brakes.map(([a, b]) => <rect key={a} x={sx(a)} y={brakeY} width={Math.max(1.5, sx(b) - sx(a))} height={8} fill="var(--accent)" />)}
        <text x={pl - 6} y={brakeY + 8} textAnchor="end" className="svg-tiny">brake</text>
        {/* speed trace */}
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line x1={pl} x2={W - pr} y1={vy(vTop * k)} y2={vy(vTop * k)} stroke="var(--grid)" />
            <text x={pl - 6} y={vy(vTop * k) + 4} textAnchor="end" className="svg-tiny">{fmt(speedToDisplay(vTop * k, u), 0)}</text>
          </g>
        ))}
        <polyline points={drawn.speed} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
        <text x={pl + 4} y={spTop - 6} className="svg-tiny">speed ({f.L.speed}) along the track</text>
        <text x={W - pr} y={H - 6} textAnchor="end" className="svg-tiny">distance → finish at {f.length(track.length, 0)}</text>
        {/* ghost and rider */}
        {status !== 'ready' && (
          <g>
            <circle cx={sx(ghost.s)} cy={hy(ghost.h)} r={7} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} strokeDasharray="3 2" />
            <text x={Math.min(sx(ghost.s), W - pr - 4)} y={hy(ghost.h) - 14} textAnchor={sx(ghost.s) > W - 70 ? 'end' : 'middle'} className="svg-tiny ghost-label">2026 winner pace</text>
          </g>
        )}
        <circle cx={sx(me.s)} cy={hy(me.h)} r={8} fill="var(--helmet)" stroke="var(--ink)" strokeWidth={2.5} />
        <line x1={sx(me.s)} x2={sx(me.s)} y1={spTop} y2={spTop + spH} stroke="var(--ink)" strokeWidth={1} opacity={0.5} />
        <circle cx={sx(me.s)} cy={vy(me.v)} r={4.5} fill="var(--ink)" />
        <g className="chip">
          <rect x={W - 178} y={top + 2} width={164} height={50} rx={10} />
          <text x={W - 96} y={top + 26} textAnchor="middle" className="clock">{formatClock(tNow)}</text>
          <text x={W - 96} y={top + 44} textAnchor="middle" className="svg-tiny">{f.speed(me.v, 0)}{me.braking ? ' · braking' : me.lateralG > 0.2 ? ` · ${fmt(me.lateralG, 1)} g turn` : ''}</text>
        </g>
      </svg>
      <p className="scene-legend small">
        Line colour = speed:
        {Array.from({ length: SPEED_STEPS }, (_, i) => <span key={i} className="legend-swatch" style={{ background: `var(--spd-${i + 1})` }} />)}
        slow → fast (up to {f.speed(vTop, 0)}) · numbers mark track sections
      </p>
      <div className="action-bar">
        <button type="button" className="btn btn-primary btn-launch" disabled={status === 'running'} onClick={() => { setSimT(0); setStatus('running'); }}>{finished ? 'Race again' : 'Drop in'}</button>
        <button type="button" className="btn" disabled={status === 'ready'} onClick={() => { setStatus('ready'); setSimT(0); }}>Reset</button>
        <button type="button" className="btn" disabled={!finished} onClick={() => setBaseline({ label: formatClock(run.time), trackId: track.id, run })}>Save as baseline</button>
        {baseOk && <p className="action-note">Baseline: {baseOk.label}</p>}
      </div>
    </div>
  );

  const controls = (
    <Card title="Track and rider" className="controls">
      <div className="feature-chips" role="group" aria-label="Choose a track">
        {TRACKS.map((t) => <button key={t.id} type="button" className={`pill-btn ${trackId === t.id ? 'is-on' : ''}`} aria-pressed={trackId === t.id} onClick={() => setTrackId(t.id)}>{t.name} · {getVenue(t.venueId)?.name}</button>)}
      </div>
      <p className="small muted">{track.event}. {track.statsNote} {track.conditions}</p>
      <div className="control-groups">
        <fieldset>
          <legend>Rider skill</legend>
          <Segmented<string> label="Start from" value={presetId} onChange={(id) => applyPreset(id as RiderPresetId)} options={(Object.keys(RIDER_PRESETS) as RiderPresetId[]).map((id) => ({ value: id, label: RIDER_PRESETS[id].label }))} />
          <Slider label="Cornering commitment" unit="% of grip" digits={0} value={cornerUse * 100} min={40} max={100} step={1} onChange={custom((v: number) => setCornerUse(v / 100))} help="How close to the tires’ limit you dare to corner." />
          <Slider label="Braking force" unit="% of grip" digits={0} value={brakeUse * 100} min={30} max={100} step={1} onChange={custom((v: number) => setBrakeUse(v / 100))} help="Harder braking means braking later." />
        </fieldset>
        <fieldset>
          <legend>Bike, body and weather</legend>
          <Segmented label="Conditions" value={cond} onChange={setCond} options={(Object.keys(CONDITIONS) as ConditionId[]).map((id) => ({ value: id, label: CONDITIONS[id].label }))} />
          <Segmented label="Body position" value={posture} onChange={setPosture} options={[{ value: 'tuck', label: 'Tuck' }, { value: 'attack', label: 'Attack' }, { value: 'upright', label: 'Upright' }]} />
          <Slider label="Rider + bike mass" unit={us ? 'lb' : 'kg'} digits={0} value={us ? mass * 2.20462 : mass} min={us ? 130 : 60} max={us ? 290 : 130} step={us ? 5 : 1} onChange={(v) => setMass(us ? v / 2.20462 : v)} />
        </fieldset>
      </div>
    </Card>
  );

  const splits = (
    <Card title="Section splits" className="splits">
      <div className="table-scroll">
        <table className="attempt-table">
          <thead><tr><th>#</th><th>Section</th><th>Time</th>{baseOk && <th>vs baseline</th>}</tr></thead>
          <tbody>
            {track.sections.map((s, i) => {
              const d = baseOk ? run.sectionTimes[i] - baseOk.run.sectionTimes[i] : 0;
              return (
                <tr key={s.name}>
                  <td>{i + 1}</td><td>{s.name}</td><td>{finished ? `${fmt(run.sectionTimes[i], 1)} s` : '—'}</td>
                  {baseOk && <td className={finished && Math.abs(d) >= 0.05 ? (d < 0 ? 'gain' : 'loss') : ''}>{finished ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d), 1)} s` : '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">Section names describe the kind of terrain. The layout is modeled to match the track’s real length, drop and winning time, not surveyed.</p>
    </Card>
  );

  const side = (
    <>
      <Card title="Race result" className="results">
        {!finished ? <p className="muted">Drop in to set a time. The dashed marker runs at the real 2026 winning pace.</p> : (
          <>
            <p className="race-time" role="status">{formatClock(run.time, 2)}</p>
            <p className={`race-delta ${delta <= 0 ? 'gain' : 'loss'}`}>{delta > 0 ? '+' : '−'}{fmt(Math.abs(delta), 2)} s vs {ref.rider}</p>
            <dl className="stats compact">
              {track.reference.map((r) => <div key={r.label}><dt>{r.label}: {r.rider}</dt><dd>{formatClock(r.seconds, 3)}</dd></div>)}
              {baseOk && <div><dt>Your baseline</dt><dd>{formatClock(baseOk.run.time, 2)} ({run.time - baseOk.run.time > 0 ? '+' : '−'}{fmt(Math.abs(run.time - baseOk.run.time), 2)} s)</dd></div>}
            </dl>
            <dl className="stats">
              <div><dt>Average speed</dt><dd>{f.speed(run.avgSpeed)}</dd></div>
              <div><dt>Top speed</dt><dd>{f.speed(run.topSpeed)}</dd></div>
              <div><dt>Hardest corner</dt><dd>{fmt(run.peakLateralG, 1)} g</dd></div>
              <div><dt>Time on the brakes</dt><dd>{fmt(run.brakingShare * 100, 0)}%</dd></div>
            </dl>
            {track.speedTrap && <p className="small muted">Real 2026 speed trap here: {f.speed(track.speedTrap.kmh / 3.6)} ({track.speedTrap.rider}), measured at one fixed point.</p>}
          </>
        )}
      </Card>

      <Card title="Where the energy went" className="energy">
        {!finished ? <p className="muted">The mountain hands you {fmt(e.potential / 1000, 0)} kJ of potential energy. Race to see who takes it back.</p> : (
          <>
            <div className="budget-bar" role="img" aria-label={budget.map((b) => `${b.label} ${fmt((b.j / eIn) * 100, 0)} percent`).join(', ')}>
              {budget.map((b) => <span key={b.key} style={{ width: `${(b.j / eIn) * 100}%`, background: b.color }} />)}
            </div>
            <ul className="budget-legend">
              {budget.map((b) => <li key={b.key}><span className="legend-swatch" style={{ background: b.color }} />{b.label}<strong>{fmt((b.j / eIn) * 100, 0)}%</strong></li>)}
            </ul>
            <p className="sample">Dropping {f.length(track.drop, 0)} gives {fmt(e.potential / 1000, 0)} kJ (m·g·h){e.pedal > 500 ? `, plus ${fmt(e.pedal / 1000, 0)} kJ from pedalling` : ''}. Your brakes turned {fmt(e.brakes / 1000, 0)} kJ into heat: enough to bring {us ? `${fmt(litres * 4.227, 1)} cups` : `${fmt(litres, 2)} L`} of water from room temperature to boiling.</p>
          </>
        )}
      </Card>

      <Card title="Test a change" className="experiments">
        <p className="small muted">Predict first, then let the model run it against your current setup.</p>
        {EXPERIMENTS.map((x) => {
          const st = tests[x.id] ?? { guess: null, shown: false };
          const alt = st.shown ? simulateRun(track, x.apply(setup)) : null;
          const d = alt ? alt.time - run.time : 0;
          const actual: Guess = Math.abs(d) < 0.5 ? 'same' : d < 0 ? 'faster' : 'slower';
          return (
            <div key={x.id} className="experiment">
              <p><strong>{x.label}.</strong> {x.change}</p>
              <div className="segmented-track" role="radiogroup" aria-label={`Prediction for ${x.label}`}>
                {(['faster', 'same', 'slower'] as Guess[]).map((g) => (
                  <button key={g} type="button" role="radio" aria-checked={st.guess === g} className={st.guess === g ? 'is-on' : ''} disabled={st.shown} onClick={() => setTests({ ...tests, [x.id]: { guess: g, shown: false } })}>
                    {g === 'same' ? 'About the same' : g === 'faster' ? 'Faster' : 'Slower'}
                  </button>
                ))}
              </div>
              {!st.shown ? (
                <button type="button" className="btn btn-small" disabled={!st.guess} onClick={() => setTests({ ...tests, [x.id]: { ...st, shown: true } })}>Test it</button>
              ) : (
                <p className={`feedback ${st.guess === actual ? 'match' : 'differ'}`} role="status">
                  <strong>{actual === 'same' ? 'About the same' : actual === 'faster' ? 'Faster' : 'Slower'}: {d > 0 ? '+' : '−'}{fmt(Math.abs(d), 1)} s.</strong> {x.why}
                </p>
              )}
            </div>
          );
        })}
      </Card>

      <LabHints hints={[
        'Watch the speed trace: it is a saw blade. Every dip is a corner, and the brake strip under the hill shows the braking before it.',
        'Raise cornering commitment by 5% and compare splits against a saved baseline. Which sections gain the most?',
        'Corner speed v = √(μ·g·r). Because of the square root, 10% more grip gives only about 5% more corner speed.',
      ]} />
      <LabLearning
        equations={
          <>
            <p className="eq">potential energy = m · g · h</p>
            <p className="eq">corner limit: v = √(μ · g · r)</p>
            <p className="small">μ is tire grip, r the corner radius. A banked berm adds to this limit because the ground pushes sideways as well as up.</p>
            <p className="eq">braking on a slope: a = μ·g·cosθ − g·sinθ</p>
            <p className="small">On a 26% slope gravity uses up about a quarter of your braking before you slow at all.</p>
            <p className="eq">drag power = ½ · ρ · C_dA · v³</p>
          </>
        }
        assumptions={[
          'The rider is a point that always brakes as late as allowed and never makes a mistake.',
          'Track sections are modeled, not surveyed. They were tuned so the “World Cup elite” preset in the dry lands near the real winning time.',
          'Grip is one number for the whole track. Real riders find lines with more grip than the average, especially in mud.',
          'No jumps, pumping or line choice. Roughness is folded into one resistance number per section.',
          'Do not use these numbers to judge real braking distances or corner speeds.',
        ]}
        reflection="Most of the mountain’s energy ends up as brake heat. If braking wastes energy, why is the fastest rider not simply the one who brakes least?"
      />
      {venue && <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'openLab', module: 'atlas', venueId: venue.id })}>{venue.name} on the World Tour →</button>}
    </>
  );

  return (
    <div className="lab-grid">
      <div className="lab-main">
        <section className="objective" aria-labelledby="rc-goal">
          <div className="objective-body">
            <p className="eyebrow">Race Run Lab · energy, grip and braking</p>
            <h2 id="rc-goal" className="goal">Race a real World Cup hill and find out where a downhill run is won: corners, brakes or the air.</h2>
          </div>
        </section>
        <section className="card scene-card" aria-label="Race run simulation">{scene}</section>
        {controls}
        {splits}
      </div>
      <aside className="lab-side">{side}</aside>
    </div>
  );
}
