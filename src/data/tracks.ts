/**
 * Race tracks for the Race Run Lab.
 *
 * What is real: each track's total length, vertical drop and the 2026 winning times (see `sources`).
 * What is modeled: the section-by-section layout. Section names describe the kind of terrain,
 * and their corners, steepness and roughness were chosen so a simulated elite rider finishes
 * close to the real winning time. They are a teaching approximation, not a survey of the hill.
 */
import type { Track, TrackSection } from '../physics/descent';

export interface RaceTrack extends Track {
  name: string;
  venueId: string;
  event: string;
  /** published figures and how sure we are of them */
  statsNote: string;
  /** finish-line altitude, m (for air density) */
  finishAltitude: number;
  reference: { label: string; rider: string; seconds: number }[];
  /** fastest speed-trap reading from the 2026 race, m/s (a fixed point on course, not the top speed) */
  speedTrap?: { rider: string; kmh: number };
  conditions: string;
  sources: { label: string; url: string }[];
}

const sec = (name: string, length: number, steepness: number, corners: number, radius: number, bankDeg: number, crr: number, pedal = false): TrackSection =>
  ({ name, length, steepness, corners, radius, bankDeg, crr, pedal });

export const TRACKS: RaceTrack[] = [
  {
    id: 'val-di-sole',
    name: 'Black Snake',
    venueId: 'val-di-sole',
    event: '2026 UCI World Championships · Val di Sole, Italy',
    length: 2100,
    drop: 540,
    statsNote: '2.1 km long, 540 m drop (Red Bull; Trailforks lists 2.14 km / 546 m).',
    finishAltitude: 850,
    reference: [
      { label: 'Elite men, world champion', rider: 'Jackson Goldstone (CAN)', seconds: 208.785 },
      { label: 'Elite women, world champion', rider: 'Valentina Höll (AUT)', seconds: 241.558 },
    ],
    conditions: 'One of the steepest, roughest tracks in racing: average gradient about 26%.',
    sections: [
      sec('Start ramp sprint', 90, 0.6, 1, 14, 12, 0.04, true),
      sec('Upper woods, roots', 330, 1.05, 9, 7, 5, 0.1),
      sec('Open piste traverse', 210, 0.8, 3, 12, 14, 0.05),
      sec('Rock garden', 260, 1.2, 6, 7, 0, 0.14),
      sec('Steep switchbacks', 330, 1.3, 10, 5.5, 8, 0.1),
      sec('Mid woods, off-camber', 300, 1.0, 8, 7, 0, 0.1),
      sec('Lower rock chutes', 290, 1.2, 7, 6.5, 4, 0.13),
      sec('Final wall', 190, 1.1, 4, 8, 6, 0.09),
      sec('Finish jumps', 100, 0.45, 1, 16, 15, 0.04, true),
    ],
    sources: [
      { label: 'UCI: Höll and Goldstone retain downhill titles', url: 'https://www.uci.org/article/uci-mountain-bike-world-championships-hoell-and-goldstone-retain-downhill-titles-in-devastating-fashion/4f9QsRTm02r2iOwmXGs1W9' },
      { label: 'Red Bull: Val di Sole track facts', url: 'https://www.redbull.com/us-en/need-to-know-uci-mtb-world-cup-val-di-sole-preview' },
    ],
  },
  {
    id: 'whistler-1199',
    name: '1199',
    venueId: 'whistler',
    event: '2026 UCI World Cup · Whistler, Canada',
    length: 2400,
    drop: 489,
    statsNote: '2.4 km long, 489 m drop (Whistler’s own World Cup page).',
    finishAltitude: 670,
    reference: [{ label: 'Elite men, race winner', rider: 'Asa Vermette (USA)', seconds: 203.93 }],
    conditions: 'Named for Stevie Smith’s 1,199 World Cup points in 2013. First World Cup held here in 2026.',
    sections: [
      sec('Start sprint', 110, 0.5, 1, 16, 12, 0.04, true),
      sec('Upper rock slabs', 330, 1.15, 7, 8, 4, 0.1),
      sec('Stevie Smith Drop', 180, 1.1, 2, 12, 8, 0.06),
      sec('Loamy woods', 420, 1.0, 10, 9, 6, 0.09),
      sec('Bike-park berms', 380, 0.85, 8, 10, 22, 0.05),
      sec('Fallaway Drop', 200, 1.2, 3, 10, 6, 0.07),
      sec('Rooty steeps', 380, 1.15, 9, 7.5, 3, 0.11),
      sec('Lower traverse', 250, 0.75, 4, 12, 10, 0.06, true),
      sec('Finish jumps', 150, 0.6, 2, 16, 15, 0.04),
    ],
    sources: [
      { label: 'Whistler: UCI World Cup course facts', url: 'https://www.whistler.com/events/uci-mtb-world-cup/' },
      { label: 'Pinkbike: 2026 Whistler elite finals results', url: 'https://www.pinkbike.com/news/results-2026-whistler-dh-world-cup-elite-finals.html' },
    ],
  },
  {
    id: 'leogang',
    name: 'Speedster',
    venueId: 'leogang',
    event: '2026 UCI World Cup · Leogang, Austria',
    length: 2500,
    drop: 480,
    statsNote: 'About 2.5 km and roughly 480 m of drop. Published figures vary (2.3–2.6 km, 469–524 m), so treat these as approximate.',
    finishAltitude: 840,
    reference: [
      { label: 'Elite men, race winner', rider: 'Finn Iles (CAN)', seconds: 195.647 },
      { label: 'Elite women, race winner', rider: 'Valentina Höll (AUT)', seconds: 224.033 },
    ],
    speedTrap: { rider: 'Dylan Maples', kmh: 66.336 },
    conditions: 'A fast bike-park track. The 2026 race was a mud race, so the real times were set on low grip.',
    sections: [
      sec('Start sprint', 120, 0.5, 1, 16, 14, 0.04, true),
      sec('Upper bike-park turns', 420, 0.9, 8, 11, 22, 0.05),
      sec('First woods', 330, 1.2, 7, 9, 4, 0.09),
      sec('Open motorway', 380, 0.9, 3, 18, 14, 0.04),
      sec('Steep stump section', 300, 1.35, 7, 8, 2, 0.11),
      sec('Mid berms and jumps', 360, 0.9, 6, 12, 22, 0.05),
      sec('Lower woods', 330, 1.2, 7, 9, 4, 0.1),
      sec('Finish straight and jumps', 260, 0.7, 2, 18, 15, 0.04, true),
    ],
    sources: [
      { label: 'Pinkbike: 2026 Leogang race analysis', url: 'https://www.pinkbike.com/news/race-analysis-mud-masterclass-and-a-dominant-win-at-the-2026-leogang-dh-world-cup.html' },
      { label: 'Saalfelden Leogang: Speedster track', url: 'https://bikepark.saalfelden-leogang.com/Press/saalfelden-leogang-s-speedster-to-host-uci-mountain-bike-downhill-world-cup_presse_72547' },
    ],
  },
];

export const getTrack = (id: string | undefined) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

/** Rider presets. "elite" is what the section layouts were calibrated against. */
export const RIDER_PRESETS = {
  elite: { label: 'World Cup elite', mass: 92, cda: 0.45, cornerUse: 0.92, brakeUse: 0.85, power: 900 },
  expert: { label: 'Fast local', mass: 92, cda: 0.5, cornerUse: 0.75, brakeUse: 0.65, power: 600 },
  weekend: { label: 'Weekend rider', mass: 92, cda: 0.55, cornerUse: 0.55, brakeUse: 0.45, power: 350 },
} as const;
export type RiderPresetId = keyof typeof RIDER_PRESETS;

/** Tire–ground friction for the conditions. Knobby tires on dirt; values are typical, not measured on these tracks. */
export const CONDITIONS = {
  dry: { label: 'Dry hardpack', mu: 1.0 },
  damp: { label: 'Damp loam', mu: 0.8 },
  mud: { label: 'Wet roots and mud', mu: 0.55 },
} as const;
export type ConditionId = keyof typeof CONDITIONS;
