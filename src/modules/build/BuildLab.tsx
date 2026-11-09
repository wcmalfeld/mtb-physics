import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BIKE_LENGTH, LEVELS, LIP_G_LIMIT, evaluateDesign, suggestDesign, type BuildLevel, type CheckStatus, type JumpDesign } from '../../physics/jumpDesign';
import type { AirFlight } from '../../physics/flight';
import { fmt, lengthFromDisplay, lengthToDisplay, speedFromDisplay, speedToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Segmented, Slider } from '../../components/ui';
import { LabHints, LabLearning } from '../labShared';

const STATUS: Record<CheckStatus, { icon: string; word: string }> = {
  pass: { icon: '✓', word: 'OK' },
  warn: { icon: '!', word: 'Check' },
  fail: { icon: '✕', word: 'Fix' },
};
const VERDICT: Record<CheckStatus, { title: string; text: string }> = {
  pass: { title: 'This design checks out', text: 'Every check passes on paper. Build it a little small, test it, then shape it to fit.' },
  warn: { title: 'Buildable, with things to check', text: 'Read the flagged items. Some are choices about your site, not mistakes.' },
  fail: { title: 'Do not build this yet', text: 'At least one check fails. Change the design until nothing is marked “Fix”.' },
};
const CHECKLIST = [
  ['Permission', 'Get a clear yes from the landowner or land manager first. Unauthorized jumps usually get flattened, and you are responsible for what you build.'],
  ['Underground lines', 'Before any digging, have buried pipes and cables located (in the US, call 811).'],
  ['Dirt', 'Squeeze a damp handful. Good jump dirt holds together as a ball: loam with plenty of clay. Sand and loose topsoil will not hold a lip.'],
  ['Water', 'Visit in heavy rain and see where water runs and pools. Never build in a low spot, and slope the ground gently to the side.'],
  ['Clear space', 'Keep both sides of the jump and the whole run-out smooth and free of trees, stumps, rocks and fences. Riders miss landings.'],
  ['Pack in layers', 'Add dirt a layer at a time, dampen it (no mud), and pack each layer hard. Save the best dirt for the lip and landing. Then let it set for several days.'],
  ['Test small', 'Roll over it first. Then add speed a little at a time. If you land on the table or go long, change the dirt, not your nerve.'],
  ['Ride it right', 'Helmet and gloves every time, never ride it alone, and check the lip and landing for damage before each session.'],
] as const;

export function BuildLab() {
  const { state, f } = useStore();
  const u = state.units;
  const us = u === 'us';

  const [level, setLevel] = useState<BuildLevel>('first');
  const [tolerance, setTolerance] = useState(0.05);
  const [design, setDesign] = useState<JumpDesign>(() => suggestDesign(6.0, 'first', 0.05));
  const [edited, setEdited] = useState(false);
  const [dist, setDist] = useState(us ? '30' : '10');
  const [secs, setSecs] = useState('');

  const resuggest = (approach = design.approach, lvl = level, tol = tolerance) => { setDesign({ ...suggestDesign(approach, lvl, tol), width: design.width }); setEdited(false); };
  const patch = (p: Partial<JumpDesign>) => { setDesign((d) => ({ ...d, ...p })); setEdited(true); };
  const setSpeed = (v: number) => (edited ? patch({ approach: v }) : resuggest(v));

  /** building dimensions: feet and inches, or meters to the centimeter */
  const dim = (m: number) => {
    if (!Number.isFinite(m)) return '—';
    if (!us) return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`;
    const totalIn = Math.round(m / 0.0254);
    const ft = Math.floor(totalIn / 12), inch = totalIn % 12;
    return ft ? `${ft}′ ${inch}″` : `${inch}″`;
  };

  const ev = useMemo(() => evaluateDesign(design, level, tolerance, 9.81, dim), [design, level, tolerance, us]); // eslint-disable-line react-hooks/exhaustive-deps
  const L = LEVELS[level];

  const measured = (() => {
    const dv = Number(dist), tv = Number(secs);
    if (!(dv > 0) || !(tv > 0)) return null;
    const v = lengthFromDisplay(dv, u) / tv;
    return v >= 4 && v <= 12 ? v : NaN;
  })();

  /* ---------- blueprint ---------- */
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(420, Math.max(260, W * 0.4)));
  const pad = { l: 26, r: 26, t: 50, b: 46 };

  const th = (design.lipAngleDeg * Math.PI) / 180;
  const la = (design.landingAngleDeg * Math.PI) / 180;
  const r = design.radius, h = design.lipHeight;
  const tr = ev.transition;
  const phiMax = tr.fits ? th : Math.acos(Math.max(-1, 1 - h / r));
  const run = tr.fits ? tr.run : r * Math.sin(phiMax);
  const landRun = ev.landingLength * Math.cos(la), landDrop = ev.landingLength * Math.sin(la);
  const flights = [ev.flights.slow, ev.flights.design, ev.flights.fast];
  const xMin = -run - 1.2;
  const xMax = Math.max(design.tableLength + landRun + 1.5, ...flights.map((fl) => (fl.ok ? fl.distance + 0.8 : 0)));
  const yMin = -Math.max(h, landDrop) - 0.25;
  const yMax = Math.max(0.8, ...flights.map((fl) => (fl.ok ? fl.apex : 0))) + 0.9;
  const scale = Math.min((W - pad.l - pad.r) / (xMax - xMin), (H - pad.t - pad.b) / (yMax - yMin));
  const ox = pad.l + ((W - pad.l - pad.r) - (xMax - xMin) * scale) / 2;
  const sx = (x: number) => ox + (x - xMin) * scale;
  const sy = (y: number) => H - pad.b - (y - yMin) * scale;

  const arcPts = Array.from({ length: 25 }, (_, i) => { const p = (phiMax * i) / 24; return `${sx(-run + r * Math.sin(p)).toFixed(1)} ${sy(-h + r * (1 - Math.cos(p))).toFixed(1)}`; });
  const endX = design.tableLength + landRun, endY = -landDrop;
  const profile = `M${sx(xMin - 3)} ${sy(-h)} L${arcPts.join(' L')} L${sx(0)} ${sy(0)} L${sx(design.tableLength)} ${sy(0)} L${sx(endX)} ${sy(endY)} L${sx(xMax + 3)} ${sy(endY)} L${sx(xMax + 3)} ${H + 5} L${sx(xMin - 3)} ${H + 5}Z`;
  const pathPts = (fl: AirFlight) => fl.path.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle') => <text x={x} y={y} textAnchor={anchor} className="scene-label small bp-label">{text}</text>;

  const blueprint = (
    <div className="scene-wrap" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="scene blueprint" role="img"
        aria-label={`Side view of the jump: lip ${dim(h)} high at ${design.lipAngleDeg} degrees, table ${dim(design.tableLength)} long, landing ${dim(ev.landingLength)} long at ${design.landingAngleDeg} degrees.`}>
        <defs>
          <marker id="bp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="var(--ink-soft)" /></marker>
          <pattern id="bp-grid" width={scale} height={scale} patternUnits="userSpaceOnUse" x={sx(0)} y={sy(0)}><path d={`M${scale} 0 H0 V${scale}`} fill="none" stroke="var(--grid)" strokeWidth={1} /></pattern>
        </defs>
        <rect width={W} height={H} fill="var(--panel-2)" />
        {!state.lowDistraction && scale > 14 && <rect width={W} height={H} fill="url(#bp-grid)" />}
        {ev.groundFall > 0.15 && <line x1={sx(0)} x2={sx(xMax + 3)} y1={sy(-h)} y2={sy(-h)} stroke="var(--ink-soft)" strokeDasharray="5 5" />}
        <path d={profile} fill="var(--dirt)" stroke="var(--trail)" strokeWidth={2.5} strokeLinejoin="round" />
        <line x1={sx(design.tableLength)} y1={sy(0)} x2={sx(endX)} y2={sy(endY)} stroke="var(--target-top)" strokeWidth={5} strokeLinecap="round" />
        {flights.map((fl, i) => fl.ok && (
          <g key={i}>
            <polyline points={pathPts(fl)} fill="none" stroke="var(--path)" strokeWidth={i === 1 ? 3.2 : 1.8} strokeDasharray={i === 1 ? undefined : '5 6'} opacity={i === 1 ? 1 : 0.8} />
            <circle cx={sx(fl.distance)} cy={sy(fl.landY)} r={i === 1 ? 5.5 : 4} fill="var(--panel)" stroke="var(--ink)" strokeWidth={2} />
          </g>
        ))}
        {/* dimensions */}
        <g className="dim">
          <line x1={sx(0)} x2={sx(design.tableLength)} y1={sy(0) - 16} y2={sy(0) - 16} markerStart="url(#bp-arrow)" markerEnd="url(#bp-arrow)" />
          <line x1={sx(0) + 14} x2={sx(0) + 14} y1={sy(0) + 3} y2={sy(-h) - 3} markerStart="url(#bp-arrow)" markerEnd="url(#bp-arrow)" />
          <line x1={sx(-run)} x2={sx(endX)} y1={H - 16} y2={H - 16} markerStart="url(#bp-arrow)" markerEnd="url(#bp-arrow)" />
        </g>
        {label(sx(design.tableLength / 2), sy(0) - 22, `table ${dim(design.tableLength)}`)}
        {label(sx(0) + 20, sy(-h / 2) + 4, `lip ${dim(h)}`, 'start')}
        {label(sx(-run * 0.62), sy(-h) - Math.max(26, h * scale * 0.55), `R ${dim(r)} · ${design.lipAngleDeg}°`)}
        {label(sx(design.tableLength + landRun * 0.5) + 8, sy(-landDrop * 0.5) - 12, `landing ${dim(ev.landingLength)} · ${design.landingAngleDeg}°`, 'start')}
        {label(sx((endX - run) / 2), H - 22, `footprint ${dim(ev.footprint)}`)}
        {label(sx(xMin) + 4, sy(-h) - 8, '→ approach', 'start')}
      </svg>
      <p className="scene-legend small">
        <span className="legend-line solid" /> your speed <span className="legend-line dashed" /> {Math.round(tolerance * 100)}% slower and faster
        {scale > 14 && !state.lowDistraction && <> · grid squares are 1 m ({us ? '3′ 3″' : '100 cm'})</>}
        {ev.groundFall > 0.15 && <> · dashed line = level ground</>}
      </p>
    </div>
  );

  /* ---------- speed window chart ---------- */
  const GW = 360, GH = 190, gl = 40, gr = 10, gt = 26, gb = 30;
  const sw = ev.sweep;
  const v0 = sw[0].approach, v1 = sw[sw.length - 1].approach;
  const eMax = Math.max(L.efhLimit * 2, 0.6);
  const gx = (v: number) => gl + ((v - v0) / (v1 - v0)) * (GW - gl - gr);
  const gy = (e: number) => GH - gb - (Math.min(e, eMax) / eMax) * (GH - gb - gt);
  const zoneRuns: { zone: string; a: number; b: number }[] = [];
  sw.forEach((p, i) => { const last = zoneRuns[zoneRuns.length - 1]; if (last && last.zone === p.zone) last.b = i; else zoneRuns.push({ zone: p.zone, a: i, b: i }); });
  const zoneName: Record<string, string> = { case: 'table', slope: 'downslope', flat: 'flat', none: 'no flight' };
  const speedTicks = [v0, design.approach, v1];
  const chart = (
    <svg viewBox={`0 0 ${GW} ${GH}`} className="mini-graph window-chart" role="img"
      aria-label={ev.sweetWindow ? `Landing impact against approach speed. Lands on the downslope under the limit from ${f.speed(ev.sweetWindow[0])} to ${f.speed(ev.sweetWindow[1])}.` : 'Landing impact against approach speed. At your speed the design misses the downslope or exceeds the impact limit.'}>
      {zoneRuns.map((z) => {
        const xa = gx(sw[z.a].approach), xb = gx(sw[Math.min(z.b + 1, sw.length - 1)].approach);
        return (
          <g key={z.a}>
            <rect x={xa} y={gt - 16} width={Math.max(0, xb - xa - 1)} height={12} rx={3} className={`zone zone-${z.zone}`} />
            {xb - xa > 46 && <text x={(xa + xb) / 2} y={gt - 7} textAnchor="middle" className="zone-text">{zoneName[z.zone]}</text>}
          </g>
        );
      })}
      <rect x={gx(design.approach * (1 - tolerance))} y={gt} width={gx(design.approach * (1 + tolerance)) - gx(design.approach * (1 - tolerance))} height={GH - gb - gt} fill="var(--accent-soft)" />
      <line x1={gl} x2={GW - gr} y1={gy(L.efhLimit)} y2={gy(L.efhLimit)} stroke="var(--warn)" strokeDasharray="5 4" strokeWidth={1.5} />
      <text x={GW - gr - 2} y={gy(L.efhLimit) - 4} textAnchor="end" className="svg-tiny">impact target</text>
      <polyline points={sw.filter((p) => Number.isFinite(p.efh)).map((p) => `${gx(p.approach).toFixed(1)},${gy(p.efh).toFixed(1)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeLinejoin="round" />
      <line x1={gx(design.approach)} x2={gx(design.approach)} y1={gt} y2={GH - gb} stroke="var(--accent)" strokeWidth={2} />
      <line x1={gl} x2={GW - gr} y1={GH - gb} y2={GH - gb} stroke="var(--ink)" />
      <line x1={gl} x2={gl} y1={gt} y2={GH - gb} stroke="var(--ink)" />
      {speedTicks.map((v, i) => <text key={i} x={gx(v)} y={GH - 16} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="svg-tiny">{fmt(speedToDisplay(v, u), 1)}</text>)}
      <text x={(gl + GW - gr) / 2} y={GH - 3} textAnchor="middle" className="svg-tiny">approach speed ({f.L.speed})</text>
      {[0, 0.5, 1].map((k) => <text key={k} x={gl - 5} y={gy(eMax * k) + 3} textAnchor="end" className="svg-tiny">{fmt(lengthToDisplay(eMax * k, u), 1)}</text>)}
      <text x={4} y={gt - 8} className="svg-tiny">drop ({f.L.length})</text>
    </svg>
  );

  const lenSlider = (label: string, key: 'lipHeight' | 'radius' | 'tableLength' | 'landingLength' | 'width', min: number, max: number, help?: string) => (
    <Slider label={label} unit={f.L.length} digits={us ? 1 : 2} value={lengthToDisplay(design[key], u)} min={lengthToDisplay(min, u)} max={lengthToDisplay(max, u)} step={us ? 0.1 : 0.05} onChange={(v) => patch({ [key]: lengthFromDisplay(v, u) })} help={help} />
  );
  const loads = ev.volume * 1.25 / 0.085;

  return (
    <div className="lab-grid build-lab">
      <div className="lab-main">
        <section className="objective no-print" aria-labelledby="bl-goal">
          <div className="objective-body">
            <p className="eyebrow">Jump Builder · design it with math, then dig</p>
            <h2 id="bl-goal" className="goal">Measure your speed, let the physics size a tabletop for it, and leave with a build sheet you can take to the dirt.</h2>
          </div>
        </section>

        <Card title="1 · Start with your real speed" className="controls no-print">
          <div className="control-groups">
            <fieldset>
              <legend>Measure it</legend>
              <p className="small">Mark two lines on the run-in where the jump will go. Roll through at the speed you would naturally carry, without braking, and have a friend time you between the lines. Do it five times and use the average.</p>
              <div className="measure-row">
                <label className="field"><span>Distance ({f.L.length})</span><input type="number" inputMode="decimal" min={1} value={dist} onChange={(e) => setDist(e.target.value)} /></label>
                <label className="field"><span>Time (s)</span><input type="number" inputMode="decimal" min={0.1} step={0.01} value={secs} onChange={(e) => setSecs(e.target.value)} placeholder="e.g. 1.45" /></label>
              </div>
              {measured === null ? <p className="small muted">speed = distance ÷ time</p>
                : Number.isNaN(measured) ? <p className="feedback neutral small" role="status">That works out outside the range this tool designs for ({f.speed(4)} to {f.speed(12)}). Check the numbers. Below that there is not enough speed for a tabletop: build a roller, or find a longer roll-in.</p>
                : <p className="feedback match small" role="status">{dist} {f.L.length} ÷ {secs} s = <strong>{f.speed(measured)}</strong> <button type="button" className="btn btn-small" onClick={() => setSpeed(measured)}>Use this speed</button></p>}
            </fieldset>
            <fieldset>
              <legend>Rider</legend>
              <Slider label="Approach speed" unit={f.L.speed} value={speedToDisplay(design.approach, u)} min={speedToDisplay(4, u)} max={speedToDisplay(12, u)} step={us ? 0.5 : 0.1} onChange={(v) => setSpeed(speedFromDisplay(v, u))} help="Speed at the bottom of the takeoff." />
              <Segmented<BuildLevel> label="Jumping experience" value={level} onChange={(lv) => { setLevel(lv); if (!edited) resuggest(design.approach, lv); }} options={(Object.keys(LEVELS) as BuildLevel[]).map((id) => ({ value: id, label: LEVELS[id].label }))} />
              <Slider label="Speed consistency" unit="% either way" digits={0} value={tolerance * 100} min={3} max={15} step={1} onChange={(v) => { setTolerance(v / 100); if (!edited) resuggest(design.approach, level, v / 100); }} help="How much your speed varies run to run. Use the spread in your five timed runs." />
            </fieldset>
          </div>
        </Card>

        <section className="card scene-card" aria-label="Jump blueprint">{blueprint}</section>

        <Card title="2 · Shape the jump" className="controls no-print" actions={<button type="button" className="btn btn-small btn-primary" onClick={() => resuggest()}>{edited ? 'Re-suggest from my speed' : 'Suggested for your speed'}</button>}>
          <p className="small muted">{edited ? 'You have changed the suggested shape. The checks on the right update as you go.' : 'These dimensions were sized from your speed. Change any of them and watch the checks.'}</p>
          <div className="control-groups">
            <fieldset>
              <legend>Takeoff</legend>
              {lenSlider('Lip height', 'lipHeight', 0.3, 2)}
              <Slider label="Lip angle" unit="°" digits={0} value={design.lipAngleDeg} min={10} max={45} step={1} onChange={(v) => patch({ lipAngleDeg: v })} />
              {lenSlider('Transition radius', 'radius', 1.5, 10, `For this speed, ${dim(ev.rMin)} or more keeps the load under ${LIP_G_LIMIT} g.`)}
              {lenSlider('Riding width', 'width', 0.9, 3)}
            </fieldset>
            <fieldset>
              <legend>Table and landing</legend>
              {lenSlider('Table length', 'tableLength', 0.4, 9)}
              <Slider label="Landing angle" unit="°" digits={0} value={design.landingAngleDeg} min={8} max={40} step={1} onChange={(v) => patch({ landingAngleDeg: v })} help="Match the angle you come down at." />
              {lenSlider('Landing length', 'landingLength', 1, 12, `One bike is about ${dim(BIKE_LENGTH)} long.`)}
            </fieldset>
          </div>
        </Card>

        <Card title="Before you dig" className="dig-list">
          <ol className="dig-steps">
            {CHECKLIST.map(([t, d]) => <li key={t}><strong>{t}.</strong> {d}</li>)}
          </ol>
          <p className="small muted">A tabletop is the right first build: if you come up short you land on dirt, not in a hole. Keep a whole line the same type, and leave about {us ? '22–26 ft' : '7–8 m'} between one landing and the next takeoff.</p>
        </Card>
      </div>

      <aside className="lab-side">
        <Card title="Design check" className={`design-check verdict-${ev.verdict}`}>
          <p className={`outcome-line ${ev.verdict === 'pass' ? 'ok' : 'short'}`} role="status"><span className="outcome-icon" aria-hidden="true">{STATUS[ev.verdict].icon}</span>{VERDICT[ev.verdict].title}</p>
          <p className="explain">{VERDICT[ev.verdict].text}</p>
          <ul className="check-list">
            {ev.checks.map((c) => (
              <li key={c.id} className={`check-${c.status}`}>
                <span className="check-badge"><span aria-hidden="true">{STATUS[c.status].icon}</span> {STATUS[c.status].word}</span>
                <span><strong>{c.title}</strong><small>{c.detail}</small></span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Speed window" className="no-print">
          {chart}
          <p className="small">The curve is how hard the landing hits (as an equal drop to flat) at each approach speed. The strip on top shows where you touch down. The shaded band is your own speed spread.</p>
          <dl className="stats compact">
            <div><dt>Lands on the downslope, under target</dt><dd>{ev.sweetWindow ? `${fmt(speedToDisplay(ev.sweetWindow[0], u), 1)}–${f.speed(ev.sweetWindow[1])}` : 'not at your speed'}</dd></div>
            <div><dt>Impact under target anywhere</dt><dd>{ev.forgivingWindow ? `${fmt(speedToDisplay(ev.forgivingWindow[0], u), 1)}–${f.speed(ev.forgivingWindow[1])}` : 'not at your speed'}</dd></div>
          </dl>
        </Card>

        <Card title="Build sheet" className="build-sheet" actions={<button type="button" className="btn btn-small no-print" onClick={() => window.print()}>Print</button>}>
          <dl className="sheet">
            <div><dt>Designed for</dt><dd>{f.speed(design.approach)} ± {Math.round(tolerance * 100)}% · {L.label}</dd></div>
            <div><dt>Lip height</dt><dd>{dim(design.lipHeight)}</dd></div>
            <div><dt>Lip angle</dt><dd>{design.lipAngleDeg}°</dd></div>
            <div><dt>Transition radius</dt><dd>{dim(design.radius)}</dd></div>
            <div><dt>Takeoff length on the ground</dt><dd>{dim(tr.run)}</dd></div>
            <div><dt>Straight ramp before the lip</dt><dd>{tr.fits ? dim(tr.straight) : 'does not fit'}</dd></div>
            <div><dt>Table length</dt><dd>{dim(design.tableLength)}</dd></div>
            <div><dt>Landing angle</dt><dd>{design.landingAngleDeg}°</dd></div>
            <div><dt>Landing length (down the slope)</dt><dd>{dim(ev.landingLength)}</dd></div>
            <div><dt>Lip width / landing width</dt><dd>{dim(design.width)} / {dim(design.width * 1.5)}</dd></div>
            <div><dt>Total footprint</dt><dd>{dim(ev.footprint)}</dd></div>
            {ev.groundFall > 0.15 && <div><dt>Ground must fall by</dt><dd>{dim(ev.groundFall)}</dd></div>}
            <div><dt>Packed dirt</dt><dd>about {us ? `${fmt(ev.volume * 1.308, 1)} cu yd` : `${fmt(ev.volume, 1)} m³`} ({Math.round(loads / 5) * 5} wheelbarrows)</dd></div>
            <div><dt>Roll-in for this speed, no pedalling</dt><dd>about {dim(ev.rollInHeight)} of drop</dd></div>
            {ev.flights.design.ok && <div><dt>Expected airtime / peak height</dt><dd>{fmt(ev.flights.design.airtime, 2)} s / {dim(ev.flights.design.apex)} above the lip</dd></div>}
          </dl>
          <p className="small"><strong>Marking the transition:</strong> drive a stake {dim(design.radius)} straight above the point where the takeoff starts, tie a string of that length to it, and sweep the curve. Stop where the surface reaches {design.lipAngleDeg}°, then run straight to the lip.</p>
          <p className="disclaimer">These numbers are a starting design from a simplified model: a rider who neither pulls up nor squashes, on a firm surface, in still air. Real riders change their takeoff speed by up to about 15% with body movement. Build the table slightly short, test at low speed, and adjust the dirt. You are responsible for what you build and ride; younger builders need an adult involved.</p>
        </Card>

        <div className="no-print">
          <LabHints hints={[
            'Flight distance grows with the square of lip speed. A rider 5% faster flies about 10% further, so the landing has to be longer than you expect.',
            'Try a steeper lip with the same speed. The table gets shorter, the airtime longer, and the transition has less room to fit under the lip.',
            'Set the landing angle a few degrees shallower than the flight path at touchdown. Equivalent drop = v⊥² ÷ 2g, and matching the angle is what shrinks v⊥.',
          ]} />
          <LabLearning
            equations={
              <>
                <p className="eq">v = distance ÷ time</p>
                <p className="eq">v_lip² = v² − 2·g·h</p>
                <p className="small">Climbing a lip of height h costs speed.</p>
                <p className="eq">r_min = v² ÷ (1.5·g)</p>
                <p className="small">The tightest transition that keeps the extra load to about 1.5 g.</p>
                <p className="eq">h = r·(1 − cos θ) + s·sin θ</p>
                <p className="small">The curve of radius r plus a straight ramp of length s must add up to the lip height at lip angle θ.</p>
                <p className="eq">range ≈ v_lip²·sin(2θ) ÷ g</p>
                <p className="small">Distance back to lip height with no air. The tool also includes drag.</p>
                <p className="eq">equivalent drop = v⊥² ÷ (2·g)</p>
                <p className="eq">roll-in drop ≈ 1.25 · v² ÷ (2·g)</p>
              </>
            }
            assumptions={[
              'The rider is a point that leaves the lip at the lip angle. Pulling up, squashing and wheelbase effects are left out.',
              'No rolling loss on the takeoff. Soft or rough dirt will make real flights shorter.',
              'Impact targets (0.5, 1.0 and 1.5 m of equivalent drop by level) are adapted from snow-park jump research. No agreed figure exists for bikes.',
              'The 1.5 g transition guide and 0.25 s straight lip come from trail-builder practice, not a formal standard.',
              'Dirt volume assumes level ground under the takeoff and table, with 30% extra for the sloped sides.',
              'The tool stops at a 2 m lip and 45°. Larger jumps are work for experienced builders.',
            ]}
            reflection="Your landing probably needs to be longer than your takeoff is tall. Use the square in the range equation to explain why, and why builders prefer to put jumps on ground that slopes downhill."
          />
        </div>
      </aside>
    </div>
  );
}
