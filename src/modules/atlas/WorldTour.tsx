import { useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import landTopo from 'world-atlas/land-110m.json';
import { RHO0, airDensity, localGravity } from '../../physics/atmosphere';
import { simulateJump } from '../../physics/flight';
import { fmt, lengthToDisplay } from '../../physics/units';
import { useStore } from '../../state/store';
import { Card, Segmented } from '../../components/ui';
import { CATEGORY, SEASON_HEADLINES, VENUES, type Category, type Venue } from '../../data/venues';
import { getFeature } from '../../data/features';

const topo = landTopo as unknown as Topology;
const LAND = feature(topo, topo.objects.land);

type RegionId = 'world' | 'europe' | 'namerica' | 'pacific';
const REGIONS: Record<RegionId, { label: string; box: [number, number, number, number] | null }> = {
  world: { label: 'World', box: null },
  europe: { label: 'Alps & Pyrenees', box: [-3, 40.5, 15, 49] },
  namerica: { label: 'North America', box: [-128, 33, -66, 54] },
  pacific: { label: 'New Zealand', box: [164, -48, 180, -34] },
};
const inBox = (v: Venue, box: [number, number, number, number] | null) => !box || (v.lon >= box[0] && v.lon <= box[2] && v.lat >= box[1] && v.lat <= box[3]);

function Pin({ cat, r }: { cat: Category; r: number }) {
  const c = CATEGORY[cat].color;
  const common = { fill: c, stroke: 'var(--panel)', strokeWidth: 1.5 };
  if (cat === 'dh') return <path d={`M${-r} ${-r * 0.8} L${r} ${-r * 0.8} L0 ${r}Z`} {...common} />;
  if (cat === 'slopestyle') return <circle r={r * 0.85} {...common} />;
  if (cat === 'freeride') return <path d={`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0Z`} {...common} />;
  return <rect x={-r * 0.78} y={-r * 0.78} width={r * 1.56} height={r * 1.56} rx={1.5} {...common} />;
}

export function WorldTour() {
  const { state, dispatch, f } = useStore();
  const u = state.units;
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [region, setRegion] = useState<RegionId>('world');
  const selected = VENUES.find((v) => v.id === state.venueId) ?? VENUES.find((v) => v.id === 'whistler')!;
  const select = (id: string) => dispatch({ type: 'selectVenue', id });

  const W = 900, H = 470;
  const { path, project } = useMemo(() => {
    const proj = geoNaturalEarth1();
    const box = REGIONS[region].box;
    if (box) proj.fitExtent([[30, 30], [W - 30, H - 30]], { type: 'MultiPoint', coordinates: [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]] });
    else proj.fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
    return { path: geoPath(proj), project: (v: Venue) => proj([v.lon, v.lat]) ?? [0, 0] };
  }, [region]);

  const visible = VENUES.filter((v) => (filter === 'all' || v.cats.includes(filter)) && inBox(v, REGIONS[region].box));
  const g = localGravity(selected.lat, selected.altitude);
  const rho = airDensity(selected.altitude);
  const booter = getFeature('slopestyle-booter')!;
  const jumpHere = simulateJump(booter.approach, booter.geo, { mass: 88, cda: 0.55 }, { rho, g, headwind: 0 });
  const jumpSea = simulateJump(booter.approach, booter.geo, { mass: 88, cda: 0.55 }, { rho: RHO0, g: 9.80665, headwind: 0 });
  const carry = jumpHere.ok && jumpSea.ok ? jumpHere.distance - jumpSea.distance : NaN;
  const pinR = region === 'world' ? 6.5 : 9;

  return (
    <div className="lab-grid atlas">
      <div className="lab-main">
        <section className="objective" aria-labelledby="wt-goal">
          <div className="objective-body">
            <p className="eyebrow">World Tour · the 2026 season</p>
            <h2 id="wt-goal" className="goal">Every venue is a physics problem. Pick a place, see what happened there, and take it into a lab.</h2>
          </div>
          <dl className="season-strip">
            {SEASON_HEADLINES.map((h) => <div key={h.label}><dt>{h.label}</dt><dd>{h.value}</dd></div>)}
          </dl>
        </section>

        <section className="card scene-card" aria-label="Map of venues">
          <div className="map-tools">
            <Segmented label="Zoom" hideLabel value={region} onChange={setRegion} options={(Object.keys(REGIONS) as RegionId[]).map((id) => ({ value: id, label: REGIONS[id].label }))} />
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="scene map" role="img" aria-label={`Map showing ${visible.length} venues. Use the venue list below to select one.`}>
            <rect width={W} height={H} fill="var(--map-sea)" />
            <path d={path({ type: 'Sphere' }) ?? ''} fill="var(--map-sea)" stroke="var(--line)" />
            <path d={path(geoGraticule10()) ?? ''} fill="none" stroke="var(--grid)" strokeWidth={0.6} />
            <path d={path(LAND) ?? ''} fill="var(--map-land)" stroke="var(--map-coast)" strokeWidth={0.7} strokeLinejoin="round" />
            {visible.filter((v) => v.id !== selected.id).map((v) => {
              const [x, y] = project(v);
              return (
                <g key={v.id} transform={`translate(${x} ${y})`} className="map-pin" onClick={() => select(v.id)} aria-hidden="true">
                  <circle r={16} fill="transparent" />
                  <Pin cat={filter !== 'all' ? filter : v.cats[0]} r={pinR} />
                  {region !== 'world' && <text y={-pinR - 5} textAnchor="middle" className="map-label">{v.name}</text>}
                </g>
              );
            })}
            {visible.some((v) => v.id === selected.id) && (() => {
              const [x, y] = project(selected);
              const flip = x > W - 150;
              return (
                <g transform={`translate(${x} ${y})`} aria-hidden="true">
                  <circle r={pinR + 7} fill="none" stroke="var(--ink)" strokeWidth={2} />
                  <Pin cat={filter !== 'all' && selected.cats.includes(filter) ? filter : selected.cats[0]} r={pinR + 1.5} />
                  <text x={flip ? -pinR - 12 : pinR + 12} y={5} textAnchor={flip ? 'end' : 'start'} className="map-label strong">{selected.name}</text>
                </g>
              );
            })()}
          </svg>
          <div className="map-legend" role="group" aria-label="Filter venues by type">
            <button type="button" className={`pill-btn ${filter === 'all' ? 'is-on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All {VENUES.length}</button>
            {(Object.keys(CATEGORY) as Category[]).map((c) => (
              <button key={c} type="button" className={`pill-btn ${filter === c ? 'is-on' : ''}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                <svg viewBox="-9 -9 18 18" width={14} height={14} aria-hidden="true"><Pin cat={c} r={7} /></svg> {CATEGORY[c].plural}
              </button>
            ))}
          </div>
        </section>

        <Card title={`Venues (${visible.length})`}>
          {visible.length === 0 && <p className="muted">No venues of this type in this view. Try the World zoom.</p>}
          <ul className="venue-list">
            {visible.map((v) => (
              <li key={v.id}>
                <button type="button" className={v.id === selected.id ? 'is-on' : ''} aria-pressed={v.id === selected.id} onClick={() => select(v.id)}>
                  <svg viewBox="-9 -9 18 18" width={16} height={16} aria-hidden="true"><Pin cat={v.cats[0]} r={7} /></svg>
                  <span><strong>{v.name}</strong><small>{v.place}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <aside className="lab-side" aria-live="polite">
        <Card className="venue-card">
          <p className="eyebrow">{selected.cats.map((c) => CATEGORY[c].label).join(' · ')}</p>
          <h2 className="venue-name">{selected.name}</h2>
          <p className="muted">{selected.place}</p>
          <p className="venue-headline">{selected.headline}</p>
          <ul className="venue-facts">{selected.facts.map((t) => <li key={t}>{t}</li>)}</ul>
        </Card>

        <Card title="The physics of this place">
          <p>{selected.physics}</p>
          <dl className="stats">
            <div><dt>Altitude (approx.)</dt><dd>{fmt(Math.round(lengthToDisplay(selected.altitude, u) / 10) * 10, 0)} {f.L.length}</dd></div>
            <div><dt>Latitude</dt><dd>{fmt(Math.abs(selected.lat), 1)}° {selected.lat >= 0 ? 'N' : 'S'}</dd></div>
            <div><dt>Local gravity</dt><dd>{fmt(g, 3)} m/s²</dd></div>
            <div><dt>Air density</dt><dd>{fmt((rho / RHO0) * 100, 0)}% of sea level</dd></div>
          </dl>
          {Number.isFinite(carry) && (
            <p className="sample">
              The same slopestyle jump at the same speed would carry <strong>{fmt(Math.abs(lengthToDisplay(carry, u)) * (u === 'us' ? 12 : 100), 0)} {u === 'us' ? 'in' : 'cm'} {carry >= 0 ? 'further' : 'shorter'}</strong> here than at sea level, from thinner air and slightly different gravity.
            </p>
          )}
          <div className="lab-links">
            {selected.labs.map((l) => (
              <button key={l.label} type="button" className="btn btn-primary btn-small" onClick={() => dispatch({ type: 'openLab', module: l.module, preset: l.preset, venueId: selected.id })}>{l.label} →</button>
            ))}
          </div>
        </Card>

        <Card title="Sources">
          <ul className="source-list">
            {selected.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.label}</a></li>)}
          </ul>
          <p className="disclaimer">Results and facts were gathered in November 2026. Coordinates and altitudes are approximate. Standard-atmosphere air density; the real value changes with weather.</p>
        </Card>
      </aside>
    </div>
  );
}
