import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { G, positionAt } from '../../physics/projectile';
import { fmt, lengthToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { playChime, usePrefersReducedMotion } from '../../components/ui';

/** Styles for saved attempts: colour + a distinct dash pattern + letter so colour is never the only cue. */
export const ATTEMPT_STYLE = {
  A: { color: 'var(--att-a)', dash: '10 6', name: 'dashed' },
  B: { color: 'var(--att-b)', dash: '2 5', name: 'dotted' },
  C: { color: 'var(--att-c)', dash: '14 5 3 5', name: 'dash-dot' },
} as const;

const X_LEFT = -4.6; // meters left of the lip (room for the ramp)

function niceGridStep(pxPerUnit: number, units: 'us' | 'metric') {
  const steps = units === 'us' ? [1, 2, 5, 10, 20] : [0.5, 1, 2, 5, 10];
  return steps.find((s) => s * pxPerUnit >= 22) ?? steps[steps.length - 1];
}

function Rider({ x, y, angleRad, size }: { x: number; y: number; angleRad: number; size: number }) {
  // Drawn facing right, origin at the wheels' contact line, unit wheelbase.
  const deg = (-angleRad * 180) / Math.PI;
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${size})`} className="rider" aria-hidden="true">
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx={-0.5} cy={-0.3} r={0.3} stroke="var(--ink)" strokeWidth={0.07} />
        <circle cx={0.5} cy={-0.3} r={0.3} stroke="var(--ink)" strokeWidth={0.07} />
        <circle cx={-0.5} cy={-0.3} r={0.05} fill="var(--ink)" />
        <circle cx={0.5} cy={-0.3} r={0.05} fill="var(--ink)" />
        {/* frame */}
        <path d="M-0.5 -0.3 L-0.02 -0.32 L-0.16 -0.74 L0.34 -0.7 L-0.02 -0.32 M0.34 -0.7 L0.5 -0.3 M-0.5 -0.3 L-0.16 -0.74" stroke="var(--accent)" strokeWidth={0.075} />
        <path d="M0.3 -0.8 L0.44 -0.84" stroke="var(--ink)" strokeWidth={0.07} />
        {/* rider */}
        <path d="M-0.14 -0.82 L0.02 -1.2 L0.38 -0.84" stroke="var(--jersey)" strokeWidth={0.12} />
        <path d="M-0.14 -0.82 L0.12 -0.55 L-0.02 -0.34" stroke="var(--ink-soft)" strokeWidth={0.1} />
      </g>
      <circle cx={0.12} cy={-1.36} r={0.13} fill="var(--helmet)" stroke="var(--ink)" strokeWidth={0.03} />
    </g>
  );
}

export function JumpScene() {
  const { state, dispatch, d, f } = useStore();
  const { params, target, units, showGrid, lowDistraction, status, current, animKey } = state;
  const reduced = usePrefersReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = Math.round(Math.min(480, Math.max(290, W * 0.42)));
  const pad = { l: W < 520 ? 40 : 52, r: 14, t: 52, b: 76 };

  /* ---------- animation (time-based, only runs while flying) ---------- */
  const [simT, setSimT] = useState(0);
  const flight = d.flight;
  useEffect(() => {
    if (status !== 'flying' || !current || !current.flight.ok) return;
    const tLand = current.flight.tLanding;
    if (reduced || lowDistraction) {
      setSimT(tLand);
      dispatch({ type: 'landed' });
      return;
    }
    // Slow-motion playback so the arc is easy to follow; physics values are unaffected.
    const duration = Math.min(3, Math.max(1.3, tLand / 0.55));
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / duration);
      setSimT(p * tLand);
      if (p < 1) raf = requestAnimationFrame(tick);
      else dispatch({ type: 'landed' });
    };
    setSimT(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, animKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === 'flying' && status === 'landed' && state.sound) playChime();
    prevStatus.current = status;
  }, [status, state.sound]);

  /* ---------- world → screen mapping ---------- */
  const pathVisible = d.revealed || status === 'flying';
  const attempts = state.showAttempts ? state.attempts : [];
  const view = useMemo(() => {
    let needX = target.start + target.width + 2.5;
    let needY = params.height + 1;
    if (pathVisible && flight.ok) {
      needX = Math.max(needX, flight.xLanding + 2.5);
      needY = Math.max(needY, flight.yApex + 0.8);
    }
    for (const a of attempts) {
      needX = Math.max(needX, a.flight.xLanding + 2.5);
      needY = Math.max(needY, a.flight.yApex + 0.8);
    }
    const xRight = Math.max(12, Math.ceil(needX / 4) * 4); // stepped zoom keeps the view stable while dragging
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;
    const scale = Math.min(plotW / (xRight - X_LEFT), plotH / Math.max(3.2, needY));
    const groundY = H - pad.b;
    const sx = (x: number) => pad.l + (x - X_LEFT) * scale;
    const sy = (y: number) => groundY - y * scale;
    const xMaxVisible = X_LEFT + plotW / scale;
    const yMaxVisible = plotH / scale;
    return { scale, sx, sy, groundY, xMaxVisible, yMaxVisible };
  }, [W, H, target.start, target.width, params.height, pathVisible, flight, attempts, pad.l, pad.r, pad.t, pad.b]);
  const { scale, sx, sy, groundY } = view;

  const toPts = (pts: { x: number; y: number }[]) => pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');

  /* ---------- grid & axes in display units ---------- */
  const unitM = units === 'us' ? 0.3048 : 1;
  const pxPerUnit = scale * unitM;
  const gStep = niceGridStep(pxPerUnit, units);
  const labelEvery = gStep * (pxPerUnit * gStep < 40 ? 5 : 2);
  const xTicks: number[] = [];
  for (let v = 0; v * unitM <= view.xMaxVisible + 1e-9; v += gStep) xTicks.push(v);
  for (let v = -gStep; v * unitM >= X_LEFT; v -= gStep) xTicks.push(v);
  const yTicks: number[] = [];
  for (let v = 0; v * unitM <= view.yMaxVisible; v += gStep) yTicks.push(v);
  const isLabel = (v: number) => Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6;

  /* ---------- rider position ---------- */
  const ramp = 1.2 + params.height * 0.9;
  const riderSize = Math.min(64, Math.max(30, scale * 1.15));
  let rider = { x: 0, y: params.height, ang: (params.angleDeg * Math.PI) / 180 };
  if ((status === 'flying' || status === 'landed') && current && current.flight.ok) {
    const tt = status === 'landed' ? current.flight.tLanding : simT;
    const p = positionAt(current.params, tt);
    const vyNow = current.flight.vy - G * tt;
    rider = {
      x: p.x,
      y: Math.max(0, p.y),
      ang: status === 'landed' ? 0 : Math.atan2(vyNow, current.flight.vx),
    };
  }

  const trail =
    status === 'flying' && current && current.flight.ok
      ? d.path.filter((p) => p.t <= simT).concat([{ ...positionAt(current.params, simT), t: simT }])
      : d.path;

  const showFullPath = pathVisible && flight.ok && status !== 'flying';
  const showLanding = d.revealed && flight.ok && status !== 'flying';
  const outcome = d.outcome;
  const tEnd = target.start + target.width;

  // launch arrow
  const arrowLen = Math.min(2.4, params.speed * 0.17) * scale;
  const th = (params.angleDeg * Math.PI) / 180;
  const ax0 = sx(0), ay0 = sy(params.height);
  const ax1 = ax0 + arrowLen * Math.cos(th), ay1 = ay0 - arrowLen * Math.sin(th);
  const arcR = Math.min(46, arrowLen * 0.55);

  const ariaLabel = d.revealed && flight.ok
    ? `Jump scene. Launch ${f.speed(params.speed)} at ${fmt(params.angleDeg, 0)} degrees from ${f.length(params.height)} high. The rider lands ${f.length(flight.xLanding)} from the takeoff. Target from ${f.length(target.start)} to ${f.length(tEnd)}. Outcome: ${outcome.kind}.`
    : `Jump scene. Launch ${f.speed(params.speed)} at ${fmt(params.angleDeg, 0)} degrees from ${f.length(params.height)} high. Target from ${f.length(target.start)} to ${f.length(tEnd)}. The path is hidden until launch.`;

  const outcomeMeta = {
    inside: { icon: '✓', text: 'Inside target', cls: 'ok' },
    short: { icon: '←', text: 'Short of target', cls: 'short' },
    overshot: { icon: '→', text: 'Beyond target', cls: 'over' },
    invalid: { icon: '?', text: 'Unable to calculate', cls: 'invalid' },
  }[outcome.kind];

  const mountains = !lowDistraction;
  const dispLen = (m: number) => fmt(lengthToDisplay(m, units), 1);

  return (
    <div className="scene-wrap" ref={wrap}>
      <svg
        className="scene"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-top)" />
            <stop offset="100%" stopColor="var(--sky-bottom)" />
          </linearGradient>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="var(--target-fill)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--target-line)" strokeWidth="3" />
          </pattern>
          <pattern id="rough" width="14" height="8" patternUnits="userSpaceOnUse">
            <rect width="14" height="8" fill="var(--dirt)" />
            <circle cx="3" cy="3" r="1.4" fill="var(--dirt-dark)" />
            <circle cx="10" cy="6" r="1.1" fill="var(--dirt-dark)" />
          </pattern>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
          </marker>
          <marker id="dimhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 1 L10 5 L0 9 z" fill="var(--ink-soft)" />
          </marker>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="url(#sky)" />
        {mountains && (
          <g aria-hidden="true" className="mountains">
            <circle cx={W * 0.84} cy={H * 0.2} r={Math.min(34, W * 0.04)} fill="var(--sun)" opacity={0.85} />
            <path d={`M0 ${groundY - H * 0.28} L${W * 0.14} ${groundY - H * 0.48} L${W * 0.27} ${groundY - H * 0.32} L${W * 0.42} ${groundY - H * 0.58} L${W * 0.58} ${groundY - H * 0.34} L${W * 0.72} ${groundY - H * 0.5} L${W * 0.88} ${groundY - H * 0.3} L${W} ${groundY - H * 0.42} L${W} ${groundY} L0 ${groundY} Z`} fill="var(--mtn-far)" />
            <path d={`M0 ${groundY - H * 0.12} L${W * 0.2} ${groundY - H * 0.26} L${W * 0.36} ${groundY - H * 0.14} L${W * 0.55} ${groundY - H * 0.3} L${W * 0.75} ${groundY - H * 0.15} L${W} ${groundY - H * 0.24} L${W} ${groundY} L0 ${groundY} Z`} fill="var(--mtn-near)" />
          </g>
        )}

        {/* grid */}
        {showGrid && (
          <g className="grid" aria-hidden="true">
            {xTicks.map((v) => (
              <line key={`gx${v}`} x1={sx(v * unitM)} x2={sx(v * unitM)} y1={pad.t - 10} y2={groundY} className={isLabel(v) ? 'major' : ''} />
            ))}
            {yTicks.map((v) => (
              <line key={`gy${v}`} x1={pad.l} x2={W - pad.r} y1={sy(v * unitM)} y2={sy(v * unitM)} className={isLabel(v) ? 'major' : ''} />
            ))}
          </g>
        )}

        {/* ground and dirt */}
        <rect x={0} y={groundY} width={W} height={H - groundY} fill="url(#rough)" />
        <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="var(--trail)" strokeWidth={3} />

        {/* landing target platform */}
        <g className="target">
          <rect x={sx(target.start)} y={groundY} width={target.width * scale} height={Math.max(10, 0.35 * scale)} fill="url(#hatch)" stroke="var(--target-line)" strokeWidth={1.5} />
          <rect x={sx(target.start)} y={groundY - 4} width={target.width * scale} height={5} fill="var(--target-top)" />
          {[target.start, tEnd].map((x, i) => (
            <g key={i} aria-hidden="true">
              <line x1={sx(x)} x2={sx(x)} y1={groundY} y2={groundY - 30} stroke="var(--ink)" strokeWidth={2} />
              <path d={`M${sx(x)} ${groundY - 30} l${i === 0 ? 14 : -14} 5 l${i === 0 ? -14 : 14} 5 z`} fill="var(--target-top)" stroke="var(--ink)" strokeWidth={1} />
            </g>
          ))}
          <text x={sx(target.start + target.width / 2)} y={groundY - 38} textAnchor="middle" className="scene-label strong">
            target {dispLen(target.width)} {f.L.length}
          </text>
        </g>

        {/* ramp */}
        <path
          d={`M${sx(-ramp)} ${groundY} Q ${sx(-ramp * 0.25)} ${groundY} ${sx(0)} ${sy(params.height)} L ${sx(0.25)} ${sy(params.height)} L ${sx(0.25)} ${groundY} Z`}
          fill="var(--ramp)"
          stroke="var(--ramp-edge)"
          strokeWidth={2}
        />

        {/* height dimension (vertical, just past the lip, under the path) */}
        <g className="dim" aria-hidden="true">
          <line x1={sx(0.25) + 12} x2={sx(0.25) + 12} y1={groundY - 2} y2={sy(params.height) + 2} markerStart="url(#dimhead)" markerEnd="url(#dimhead)" />
          <text x={sx(0.25) + 18} y={(groundY + sy(params.height)) / 2} dominantBaseline="middle" className="scene-label">
            h {dispLen(params.height)} {f.L.length}
          </text>
        </g>

        {/* gap dimension (horizontal) */}
        <g className="dim" aria-hidden="true">
          <line x1={sx(0)} x2={sx(target.start)} y1={groundY + 22} y2={groundY + 22} markerStart="url(#dimhead)" markerEnd="url(#dimhead)" />
          <text x={(sx(0) + sx(target.start)) / 2} y={groundY + 17} textAnchor="middle" className="scene-label on-dirt">
            gap {dispLen(target.start)} {f.L.length}
          </text>
        </g>

        {/* axes */}
        <g className="axes" aria-hidden="true">
          {xTicks.filter((v) => v >= 0 && isLabel(v)).map((v) => (
            <text key={`tx${v}`} x={sx(v * unitM)} y={H - 20} textAnchor="middle" className="tick">
              {v}
            </text>
          ))}
          <text x={W - pad.r} y={H - 4} textAnchor="end" className="axis-title">
            x: horizontal distance ({f.L.length})
          </text>
          <line x1={pad.l - 6} x2={pad.l - 6} y1={groundY} y2={pad.t - 8} stroke="var(--ink-soft)" strokeWidth={1} />
          {yTicks.filter((v) => isLabel(v)).map((v) => (
            <text key={`ty${v}`} x={pad.l - 10} y={sy(v * unitM)} textAnchor="end" dominantBaseline="middle" className="tick">
              {v}
            </text>
          ))}
          <text x={pad.l + 4} y={pad.t + 6} className="axis-title">y: height ({f.L.length})</text>
        </g>

        {/* saved attempts */}
        {attempts.map((a) => {
          const st = ATTEMPT_STYLE[a.label];
          const lx = sx(a.flight.xLanding);
          return (
            <g key={a.id} className="attempt">
              <polyline points={toPts(a.path)} fill="none" stroke={st.color} strokeWidth={3} strokeDasharray={st.dash} strokeLinecap="round" />
              <circle cx={lx} cy={groundY - 12} r={10} fill="var(--panel)" stroke={st.color} strokeWidth={2.5} />
              <text x={lx} y={groundY - 12} textAnchor="middle" dominantBaseline="central" className="attempt-letter">
                {a.label}
              </text>
            </g>
          );
        })}

        {/* launch direction arrow (always visible; it is an input, not a result) */}
        <g aria-hidden="true">
          <line x1={ax0} x2={ax0 + arcR * 1.6} y1={ay0} y2={ay0} stroke="var(--ink-soft)" strokeDasharray="4 4" />
          <path d={`M ${ax0 + arcR} ${ay0} A ${arcR} ${arcR} 0 0 0 ${ax0 + arcR * Math.cos(th)} ${ay0 - arcR * Math.sin(th)}`} fill="none" stroke="var(--ink-soft)" strokeWidth={1.5} />
          <line x1={ax0} y1={ay0} x2={ax1} y2={ay1} stroke="var(--accent)" strokeWidth={3.5} markerEnd="url(#arrowhead)" />
          <text x={ax0 + arcR + 6} y={ay0 - 6} className="scene-label small">θ {fmt(params.angleDeg, 0)}°</text>
        </g>

        {/* current trajectory */}
        {pathVisible && flight.ok && (
          <polyline
            points={toPts(showFullPath ? d.path : trail)}
            fill="none"
            stroke="var(--path)"
            strokeWidth={3.5}
            strokeLinecap="round"
            className={status === 'ready' ? 'path-preview' : 'path-live'}
          />
        )}

        {/* landing marker */}
        {showLanding && flight.ok && (
          <g className="landing-mark">
            <path d={`M${sx(flight.xLanding) - 7} ${groundY - 7} l14 14 m0 -14 l-14 14`} stroke="var(--ink)" strokeWidth={3} />
            <rect x={sx(flight.xLanding) - 52} y={groundY + 27} width={104} height={18} rx={4} className="label-bg" />
            <text x={sx(flight.xLanding)} y={groundY + 40} textAnchor="middle" className="scene-label strong">
              lands {dispLen(flight.xLanding)} {f.L.length}
            </text>
          </g>
        )}

        <Rider x={sx(rider.x)} y={sy(rider.y)} angleRad={rider.ang} size={riderSize} />

        {/* in-scene info chips */}
        <g className="chip">
          <rect x={8} y={8} width={Math.min(W - 16, 300)} height={30} rx={8} />
          <text x={18} y={28} className="chip-text">
            v₀ {fmt(units === 'us' ? params.speed / 0.44704 : params.speed, 1)} {f.L.speed} · θ {fmt(params.angleDeg, 0)}° · h {dispLen(params.height)} {f.L.length}
          </text>
        </g>
        {showLanding && W >= 440 && (
          <g className={`chip outcome-chip ${outcomeMeta.cls}`}>
            <rect x={W - 190} y={8} width={182} height={30} rx={8} />
            <text x={W - 99} y={28} textAnchor="middle" className="chip-text strong">
              {outcomeMeta.icon} {outcomeMeta.text}
            </text>
          </g>
        )}
        {!pathVisible && (
          <g className="chip hidden-chip">
            <rect x={W / 2 - 150} y={pad.t} width={300} height={30} rx={8} />
            <text x={W / 2} y={pad.t + 20} textAnchor="middle" className="chip-text">
              Path hidden — predict, then Launch
            </text>
          </g>
        )}
      </svg>
      {showLanding && W < 440 && (
        <p className={`outcome-inline ${outcomeMeta.cls}`}>
          {outcomeMeta.icon} {outcomeMeta.text}
        </p>
      )}
    </div>
  );
}
