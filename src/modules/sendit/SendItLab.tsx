import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { impactG, simulateJump, terrainPoints, type Air, type AirFlight, type JumpGeometry } from '../../physics/flight';
import { RHO0, airDensity, localGravity } from '../../physics/atmosphere';
import { fmt, lengthFromDisplay, lengthToDisplay, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Segmented, Slider, Switch, playChime, usePrefersReducedMotion } from '../../components/ui';
import { Rider } from '../../components/Rider';
import { LabHints, LabLearning } from '../labShared';
import { FEATURES, getFeature } from '../../data/features';
import { VENUES, getVenue } from '../../data/venues';

type Posture = 'tucked' | 'neutral' | 'upright';
const CDA: Record<Posture, number> = { tucked: 0.4, neutral: 0.55, upright: 0.7 };
const ZONE_TEXT = {
  case: { title: 'Came up short', cls: 'short', icon: '↓' },
  slope: { title: 'Landed on the downslope', cls: 'ok', icon: '✓' },
  flat: { title: 'Overshot to flat', cls: 'over', icon: '→' },
} as const;
type Guess = keyof typeof ZONE_TEXT;

export function SendItLab() {
  const { state, dispatch, f } = useStore();
  const u = state.units;
  const us = u === 'us';
  const reduced = usePrefersReducedMotion() || state.lowDistraction;

  const start = getFeature(state.preset) ?? FEATURES[1];
  const [featureId, setFeatureId] = useState(start.id);
  const [approach, setApproach] = useState(start.approach);
  const [geo, setGeo] = useState<JumpGeometry>(start.geo);
  const [venueId, setVenueId] = useState<string>(state.preset ? state.venueId ?? start.venueId ?? 'sea' : 'sea');
  const [airOn, setAirOn] = useState(true);
  const [headwind, setHeadwind] = useState(0);
  const [posture, setPosture] = useState<Posture>('neutral');
  const [mass, setMass] = useState(88);
  const [absorb, setAbsorb] = useState(0.55);
  const [predict, setPredict] = useState(false);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [status, setStatus] = useState<'ready' | 'flying' | 'landed'>('ready');
  const [simT, setSimT] = useState(0);
  const [shapeOpen, setShapeOpen] = useState(false);

  const feature = getFeature(featureId);
  const venue = getVenue(venueId);
  const air: Air = useMemo(() => ({
    rho: airOn ? (venue ? airDensity(venue.altitude) : RHO0) : 0,
    g: venue ? localGravity(venue.lat, venue.altitude) : 9.81,
    headwind: airOn ? headwind : 0,
  }), [airOn, venue, headwind]);
  const body = useMemo(() => ({ mass, cda: CDA[posture] }), [mass, posture]);

  const res = useMemo(() => simulateJump(approach, geo, body, air), [approach, geo, body, air]);
  const vacuum = useMemo(() => simulateJump(approach, geo, body, { rho: 0, g: air.g, headwind: 0 }), [approach, geo, body, air.g]);
  const gust = useMemo(() => simulateJump(approach, geo, body, { ...air, rho: air.rho || RHO0, headwind: air.headwind + 5 }), [approach, geo, body, air]);

  // any change to the setup makes the old flight stale
  useEffect(() => { setStatus('ready'); setGuess(null); }, [approach, geo, body, air]);

  const loadFeature = (id: string) => {
    const ft = getFeature(id);
    if (!ft) return;
    setFeatureId(id);
    setApproach(ft.approach);
    setGeo(ft.geo);
    setHeadwind(0);
  };
  const patchGeo = (p: Partial<JumpGeometry>) => { setGeo((g0) => ({ ...g0, ...p })); setFeatureId('custom'); };

  /* ---------- animation ---------- */
  useEffect(() => {
    if (status !== 'flying' || !res.ok) return;
    if (reduced) { setSimT(res.airtime); setStatus('landed'); return; }
    const duration = Math.min(4.5, Math.max(1.4, res.airtime / 0.6));
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / duration);
      setSimT(p * res.airtime);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setStatus('landed'); if (state.sound) playChime(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const revealed = !predict || status === 'landed';
  const showPath = revealed || status === 'flying';

  /* ---------- scene ---------- */
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(500, Math.max(300, W * 0.5)));
  const pad = { l: 16, r: 16, t: 44, b: 34 };

  const terr = terrainPoints(geo);
  const lipRad = (Math.max(geo.lipAngleDeg, 8) * Math.PI) / 180;
  const ctrlX = -geo.lipHeight / Math.tan(lipRad);
  const rampStartX = ctrlX * 1.7 - 1;
  const endX = terr[terr.length - 2].x;
  const view = useMemo(() => {
    const xMin = rampStartX - 2.5;
    let xMax = endX + Math.max(3, geo.gap * 0.18);
    let yMax = Math.max(1.2, geo.knuckleHeight + 1) + 1.6;
    const yMin = Math.min(...terr.map((p) => p.y)) - 0.8;
    for (const r of [res, vacuum]) if (showPath && r.ok) { xMax = Math.max(xMax, r.distance + 2); yMax = Math.max(yMax, r.apex + 1.8); }
    // step the view so dragging a slider moves the rider, not the camera
    const stepX = xMax - xMin > 30 ? 5 : 2;
    xMax = Math.ceil(xMax / stepX) * stepX;
    yMax = Math.ceil(yMax);
    const scale = Math.min((W - pad.l - pad.r) / (xMax - xMin), (H - pad.t - pad.b) / (yMax - yMin));
    const ox = pad.l + ((W - pad.l - pad.r) - (xMax - xMin) * scale) / 2;
    const sx = (x: number) => ox + (x - xMin) * scale;
    const sy = (y: number) => H - pad.b - (y - yMin) * scale;
    return { sx, sy, scale, xMin, xMax, yMin };
  }, [W, H, geo, res, vacuum, showPath, rampStartX, endX]); // eslint-disable-line react-hooks/exhaustive-deps
  const { sx, sy, scale } = view;

  const ground = [
    `M${sx(view.xMin - 5)} ${sy(-geo.lipHeight)}`,
    `L${sx(rampStartX)} ${sy(-geo.lipHeight)}`,
    `Q${sx(ctrlX)} ${sy(-geo.lipHeight)} ${sx(0)} ${sy(0)}`,
    ...terr.map((p) => `L${sx(p.x)} ${sy(p.y)}`),
    `L${sx(view.xMax + 400)} ${H + 10} L${sx(view.xMin - 5)} ${H + 10} Z`,
  ].join(' ');

  const toPts = (fl: AirFlight) => fl.path.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const at = (fl: AirFlight, t: number) => {
    const pth = fl.path;
    let i = 1;
    while (i < pth.length - 1 && pth[i].t < t) i++;
    const a = pth[i - 1], b = pth[i];
    const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, vx: a.vx + (b.vx - a.vx) * k, vy: a.vy + (b.vy - a.vy) * k };
  };

  const riderSize = Math.max(18, Math.min(46, scale * 1.15));
  let rider = { x: sx(rampStartX - 0.6), y: sy(-geo.lipHeight), tilt: 0 };
  if (res.ok && status !== 'ready') {
    const p = at(res, status === 'landed' ? res.airtime : simT);
    const landedTilt = -res.surfaceAngleDeg;
    rider = { x: sx(p.x), y: sy(p.y), tilt: status === 'landed' ? landedTilt : (Math.atan2(p.vy, p.vx) * 180) / Math.PI };
  }

  const zone = res.ok ? ZONE_TEXT[res.zone] : null;
  const windLabel = headwind === 0 ? 'No wind' : `${fmt(Math.abs(speedToDisplay(headwind, u)), 0)} ${f.L.speed} ${headwind > 0 ? 'headwind' : 'tailwind'}`;
  const ariaScene = !res.ok ? res.reason : revealed
    ? `${feature?.name ?? 'Custom jump'}: ${zone!.title}. Flew ${f.length(res.distance)} in ${f.time(res.airtime)}.`
    : `${feature?.name ?? 'Custom jump'}: the landing is hidden until you launch.`;

  const scene = (
    <div className="scene-wrap" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="scene" role="img" aria-label={ariaScene}>
        <defs>
          <linearGradient id="si-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sky-top)" />
            <stop offset="1" stopColor="var(--sky-bottom)" />
          </linearGradient>
          {([['dim', 'var(--ink-soft)'], ['info', 'var(--info)'], ['vx', 'var(--vx)'], ['vy', 'var(--vy)']] as const).map(([k, c]) => (
            <marker key={k} id={`si-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10z" fill={c} />
            </marker>
          ))}
        </defs>
        <rect width={W} height={H} fill="url(#si-sky)" />
        {!state.lowDistraction && airOn && headwind !== 0 && [0.18, 0.34, 0.5, 0.66, 0.82].map((k, i) => {
          const len = 18 + Math.min(60, Math.abs(headwind) * 5);
          const x = W * k + (i % 2) * 20, y = pad.t + 14 + ((i * 37) % 70);
          return <line key={k} x1={headwind > 0 ? x + len : x} x2={headwind > 0 ? x : x + len} y1={y} y2={y} stroke="var(--info)" strokeWidth={2} strokeDasharray="6 4" markerEnd="url(#si-arrow-info)" opacity={0.7} />;
        })}
        <path d={ground} fill="var(--dirt)" stroke="var(--trail)" strokeWidth={2.5} strokeLinejoin="round" />
        {/* the part of the landing you want to hit */}
        <line x1={sx(geo.gap)} y1={sy(geo.knuckleHeight)} x2={sx(endX)} y2={sy(terr[terr.length - 2].y)} stroke="var(--target-top)" strokeWidth={5} strokeLinecap="round" />
        <text x={sx((geo.gap + endX) / 2)} y={sy((geo.knuckleHeight + terr[terr.length - 2].y) / 2) + 22} textAnchor="middle" className="scene-label small on-dirt">landing</text>
        {/* gap dimension */}
        <g className="dim">
          <line x1={sx(0)} x2={sx(geo.gap)} y1={pad.t - 14} y2={pad.t - 14} markerStart="url(#si-arrow-dim)" markerEnd="url(#si-arrow-dim)" />
          <line x1={sx(0)} x2={sx(0)} y1={pad.t - 20} y2={sy(0) - 4} strokeDasharray="3 4" />
          <line x1={sx(geo.gap)} x2={sx(geo.gap)} y1={pad.t - 20} y2={sy(geo.knuckleHeight) - 4} strokeDasharray="3 4" />
        </g>
        <text x={sx(geo.gap / 2)} y={pad.t - 20} textAnchor="middle" className="scene-label small">gap {f.length(geo.gap)}</text>

        {showPath && vacuum.ok && airOn && <polyline points={toPts(vacuum)} fill="none" stroke="var(--ink-soft)" strokeWidth={2} strokeDasharray="3 6" opacity={0.75} />}
        {showPath && res.ok && (
          <polyline points={toPts(res)} fill="none" stroke="var(--path)" strokeWidth={3.5} strokeLinecap="round" opacity={status === 'ready' ? 0.55 : 1} strokeDasharray={status === 'ready' ? '9 7' : undefined} />
        )}
        {showPath && res.ok && status === 'landed' && (() => {
          const lx = sx(res.distance), ly = sy(res.landY);
          const a = (-res.surfaceAngleDeg * Math.PI) / 180;
          const k = Math.min(5, 70 / Math.max(res.impactSpeed, 1));
          return (
            <g>
              <line x1={lx} y1={ly} x2={lx + Math.cos(a) * res.vPar * k} y2={ly - Math.sin(a) * res.vPar * k} stroke="var(--vx)" strokeWidth={3} markerEnd="url(#si-arrow-vx)" />
              <line x1={lx - Math.sin(a) * res.vPerp * k} y1={ly - Math.cos(a) * res.vPerp * k} x2={lx} y2={ly} stroke="var(--vy)" strokeWidth={3} markerEnd="url(#si-arrow-vy)" />
              <circle cx={lx} cy={ly} r={5} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} />
            </g>
          );
        })()}
        <Rider x={rider.x} y={rider.y} size={riderSize} tiltDeg={rider.tilt} />
        <g className="chip">
          <rect x={10} y={H - 30} width={Math.max(150, windLabel.length * 7.6 + 24)} height={22} rx={11} />
          <text x={22} y={H - 15} className="chip-text">{airOn ? windLabel : 'Vacuum: no air'}</text>
        </g>
        {!showPath && (
          <g className="chip hidden-chip">
            <rect x={W / 2 - 150} y={pad.t + 6} width={300} height={26} rx={13} />
            <text x={W / 2} y={pad.t + 24} textAnchor="middle" className="chip-text">Path hidden. Predict, then launch.</text>
          </g>
        )}
      </svg>
      {showPath && airOn && (
        <p className="scene-legend small">
          <span className="legend-line solid" /> with air <span className="legend-line dotted" /> same jump in a vacuum
          {status === 'landed' && <> · <span className="key vx" /> speed kept along the landing <span className="key vy" /> speed driven into the ground</>}
        </p>
      )}
      <div className="action-bar">
        <button type="button" className="btn btn-primary btn-launch" disabled={!res.ok || status === 'flying' || (predict && !guess && status !== 'landed')} onClick={() => { setSimT(0); setStatus('flying'); }}>
          {status === 'landed' ? 'Send it again' : 'Send it'}
        </button>
        <button type="button" className="btn" disabled={status === 'ready'} onClick={() => { setStatus('ready'); setGuess(null); }}>Reset</button>
        {predict && !guess && status === 'ready' && <p className="action-note">Pick a prediction first.</p>}
      </div>
    </div>
  );

  /* ---------- controls ---------- */
  const len = (label: string, key: 'lipHeight' | 'gap' | 'landingLength' | 'knuckleHeight', min: number, max: number, help?: string) => (
    <Slider label={label} unit={f.L.length} value={lengthToDisplay(geo[key], u)} min={lengthToDisplay(min, u)} max={lengthToDisplay(max, u)} step={us ? 0.5 : 0.1} onChange={(v) => patchGeo({ [key]: lengthFromDisplay(v, u) })} help={help} />
  );
  const controls = (
    <Card title="Set up the send" className="controls">
      <div className="feature-chips" role="group" aria-label="Choose a jump">
        {FEATURES.map((ft) => (
          <button key={ft.id} type="button" className={`pill-btn ${featureId === ft.id ? 'is-on' : ''}`} aria-pressed={featureId === ft.id} onClick={() => loadFeature(ft.id)}>{ft.name}</button>
        ))}
        {featureId === 'custom' && <span className="pill-btn is-on">Custom shape</span>}
      </div>
      <div className="control-groups">
        <fieldset>
          <legend>Rider</legend>
          <Slider label="Approach speed" unit={f.L.speed} value={speedToDisplay(approach, u)} min={speedToDisplay(4, u)} max={speedToDisplay(30, u)} step={us ? 0.5 : 0.1} onChange={(v) => setApproach(speedFromDisplay(v, u))} help="Speed at the bottom of the takeoff, before climbing the lip." />
          <Segmented label="Body position" value={posture} onChange={setPosture} options={[{ value: 'tucked', label: 'Tucked' }, { value: 'neutral', label: 'Neutral' }, { value: 'upright', label: 'Upright' }]} />
          <Slider label="Rider + bike mass" unit={us ? 'lb' : 'kg'} digits={0} value={us ? mass * 2.20462 : mass} min={us ? 110 : 50} max={us ? 290 : 130} step={us ? 5 : 1} onChange={(v) => setMass(us ? v / 2.20462 : v)} />
        </fieldset>
        <fieldset>
          <legend>Air</legend>
          <Switch label="Air resistance" hint="Off = the textbook vacuum" checked={airOn} onChange={setAirOn} />
          <Slider label="Wind" unit={f.L.speed} digits={0} value={speedToDisplay(headwind, u)} min={speedToDisplay(-15, u)} max={speedToDisplay(15, u)} step={1} disabled={!airOn} lockedReason="Turn air resistance on to add wind." onChange={(v) => setHeadwind(speedFromDisplay(v, u))} help="Positive = headwind, negative = tailwind." />
          <label className="field">
            <span>Location (sets gravity and air density)</span>
            <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="sea">Sea level, standard air</option>
              {VENUES.map((v) => <option key={v.id} value={v.id}>{v.name} · {Math.round(lengthToDisplay(v.altitude, u) / (us ? 100 : 50)) * (us ? 100 : 50)} {f.L.length}</option>)}
            </select>
          </label>
        </fieldset>
      </div>
      <button type="button" className="btn btn-small btn-ghost shape-toggle" aria-expanded={shapeOpen} onClick={() => setShapeOpen(!shapeOpen)}>{shapeOpen ? '▾ Hide jump shape' : '▸ Reshape the jump'}</button>
      {shapeOpen && (
        <div className="control-groups">
          <fieldset>
            <legend>Takeoff</legend>
            <Slider label="Lip angle" unit="°" digits={0} value={geo.lipAngleDeg} min={5} max={60} step={1} onChange={(v) => patchGeo({ lipAngleDeg: v })} />
            {len('Lip height', 'lipHeight', 0.3, 8, 'Climbing the lip costs speed.')}
            {len('Gap', 'gap', 1.5, 40)}
          </fieldset>
          <fieldset>
            <legend>Landing</legend>
            <Slider label="Landing steepness" unit="°" digits={0} value={geo.landingAngleDeg} min={0} max={50} step={1} onChange={(v) => patchGeo({ landingAngleDeg: v })} help="0° is a flat landing." />
            {len('Landing length', 'landingLength', 2, 20)}
            {len('Knuckle height vs lip', 'knuckleHeight', -8, 4, 'Negative = step-down, positive = step-up.')}
          </fieldset>
        </div>
      )}
    </Card>
  );

  /* ---------- side ---------- */
  const load = res.ok ? impactG(res.vPerp, absorb, air.g) : NaN;
  const side = (
    <>
      <Card title="Prediction" className="predict">
        <Switch label="Predict first" hint="Hides the flight path until you commit" checked={predict} onChange={(on) => { setPredict(on); setGuess(null); setStatus('ready'); }} />
        {predict && (
          <fieldset className="choice-set" disabled={status !== 'ready'}>
            <legend>Where will the rider touch down?</legend>
            {(Object.keys(ZONE_TEXT) as Guess[]).map((k) => (
              <label key={k} className={`choice ${guess === k ? 'is-on' : ''}`}>
                <input type="radio" name="si-guess" checked={guess === k} onChange={() => setGuess(k)} />
                {k === 'case' ? 'Short of the landing' : k === 'slope' ? 'On the downslope' : 'Past it, on the flat'}
              </label>
            ))}
          </fieldset>
        )}
        {predict && status === 'landed' && res.ok && guess && (
          <p className={`feedback ${guess === res.zone ? 'match' : 'differ'}`} role="status">
            {guess === res.zone ? 'Your prediction matched.' : `You predicted “${ZONE_TEXT[guess].title.toLowerCase()}”. What did the model account for that you didn’t?`}
          </p>
        )}
      </Card>

      <Card title="Flight report" className="results">
        {!res.ok ? (
          <p className="feedback neutral" role="status"><strong>No flight.</strong> {res.reason}</p>
        ) : !revealed ? (
          <p className="muted">Results appear after you launch.</p>
        ) : (
          <>
            <p className={`outcome-line ${zone!.cls}`} role="status"><span className="outcome-icon" aria-hidden="true">{zone!.icon}</span>{zone!.title}</p>
            <p className="explain">
              {res.zone === 'case' && `Touched down ${f.length(-res.pastKnuckle)} short of the knuckle. The ground there faces the rider, so almost all the speed goes straight into it.`}
              {res.zone === 'slope' && `Touched down ${f.length(res.pastKnuckle)} past the knuckle. The slope falls away at ${fmt(res.surfaceAngleDeg, 0)}° and the rider arrives only ${fmt(res.mismatchDeg, 0)}° steeper than that.`}
              {res.zone === 'flat' && `Flew ${f.length(res.distance - endX)} past the end of the downslope and met flat ground at ${fmt(res.mismatchDeg, 0)}°.`}
            </p>
            <dl className="stats">
              <div><dt>Speed at the lip</dt><dd>{f.speed(res.takeoffSpeed)}</dd></div>
              <div><dt>Airtime</dt><dd>{f.time(res.airtime)}</dd></div>
              <div><dt>Distance flown</dt><dd>{f.length(res.distance)}</dd></div>
              <div><dt>Peak height above lip</dt><dd>{f.length(res.apex)}</dd></div>
              <div><dt>Speed into the ground</dt><dd>{f.speed(res.vPerp)}</dd></div>
              <div><dt>Feels like a drop to flat of</dt><dd>{f.length(res.equivalentDrop)}</dd></div>
            </dl>
            <div className="meter" role="img" aria-label={`Average landing load about ${fmt(load, 1)} g`}>
              <div className="meter-top"><span>Landing load (average)</span><strong>{fmt(load, 1)} g</strong></div>
              <div className="meter-track"><div className={`meter-fill ${load > 6 ? 'hot' : load > 3.5 ? 'warm' : ''}`} style={{ width: `${Math.min(100, (load / 10) * 100)}%` }} /></div>
            </div>
            <Slider label="Absorbing distance" unit={us ? 'in' : 'cm'} digits={0} value={us ? absorb / 0.0254 : absorb * 100} min={us ? 4 : 10} max={us ? 36 : 90} step={us ? 1 : 2} onChange={(v) => setAbsorb(us ? v * 0.0254 : v / 100)} help="Suspension travel plus how far arms and legs bend." />
            {airOn && vacuum.ok && (
              <p className="sample">
                <strong>Air check:</strong> in a vacuum this jump goes {f.length(vacuum.distance)}. Air and wind changed that by {f.length(res.distance - vacuum.distance)}.
                {gust.ok && <> A sudden extra {us ? '11 mph' : '5 m/s'} gust would move the landing by {f.length(gust.distance - res.distance)}{gust.zone !== res.zone ? `, enough to turn this into “${ZONE_TEXT[gust.zone].title.toLowerCase()}”` : ''}.</>}
              </p>
            )}
            <p className="small muted">Here: g = {fmt(air.g, 3)} m/s², air density {fmt(((airOn ? air.rho : 0) / RHO0) * 100, 0)}% of sea level.</p>
          </>
        )}
        <p className="disclaimer">A point-mass model for learning. It does not tell you whether a real jump is safe to ride.</p>
      </Card>

      {feature && (
        <Card title={feature.name} className="feature-card">
          <p className="small muted">{feature.where}</p>
          <p><strong>Mission:</strong> {feature.mission}</p>
          <dl className="provenance">
            <div><dt>Published</dt><dd>{feature.real}</dd></div>
            <div><dt>Modeled</dt><dd>{feature.modeled}</dd></div>
          </dl>
          {feature.venueId && (
            <button type="button" className="btn btn-small" onClick={() => dispatch({ type: 'openLab', module: 'atlas', venueId: feature.venueId! })}>See it on the World Tour →</button>
          )}
        </Card>
      )}

      <LabHints hints={[
        'Climbing the lip turns some speed into height before you even take off. Compare “approach speed” with “speed at the lip”.',
        'Switch air resistance off, launch, then on again. The dotted line is the vacuum path. Bigger, faster jumps lose more.',
        'A landing hurts in proportion to the speed driven into the ground, squared. Match the landing angle to your flight path and that speed shrinks.',
      ]} />
      <LabLearning
        equations={
          <>
            <p className="eq">v_lip² = v_approach² − 2·g·h</p>
            <p className="small">Energy conservation up the takeoff: kinetic energy becomes height.</p>
            <p className="eq">F_drag = ½·ρ·C_dA·v_air²</p>
            <p className="small">ρ is air density, C_dA is how much air you catch, v_air is your speed through the air (wind included).</p>
            <p className="eq">v⊥ = v·sin(angle between path and ground)</p>
            <p className="eq">equivalent drop = v⊥² / (2·g)</p>
            <p className="small">Only the part of your velocity pointing into the ground has to be stopped. That is why a 30 ft step-down onto a matching slope can feel softer than a 3 ft drop to flat.</p>
            <p className="eq">average load ≈ v⊥² / (2·d·g) + 1</p>
            <p className="small">d is the distance over which suspension and limbs absorb the hit.</p>
          </>
        }
        assumptions={[
          'The rider and bike are one point. No pumping, popping or squashing the lip.',
          'Drag acts on a fixed body position. Wind is steady and blows along the jump line only.',
          'No friction or suspension losses on the takeoff.',
          'Landing load is an average over the absorbing distance. Real peaks are higher.',
          'Real jumps are built and tested by experts. This model leaves out too much to judge whether any jump is safe.',
        ]}
        reflection="Rampage 2026 was stopped for wind. Use the gust numbers you found here to explain why organizers could not just ask riders to pedal a little harder."
      />
    </>
  );

  return (
    <div className="lab-grid">
      <div className="lab-main">
        <section className="objective" aria-labelledby="si-goal">
          <div className="objective-body">
            <p className="eyebrow">Send It Lab · real air, real landings</p>
            <h2 id="si-goal" className="goal">Clear the gap, land on the downslope, and find out what the air and the landing angle do to you.</h2>
          </div>
        </section>
        <section className="card scene-card" aria-label="Jump simulation">{scene}</section>
        {controls}
      </div>
      <aside className="lab-side">{side}</aside>
    </div>
  );
}
