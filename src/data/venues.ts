/**
 * Real places from the 2026 season, and what each one can teach.
 *
 * Results and facts were collected in November 2026 from the sources listed on each venue.
 * Coordinates and altitudes are approximate (good enough for a map pin and an air-density estimate).
 */
import type { ModuleId } from '../state/store';

export type Category = 'dh' | 'slopestyle' | 'freeride' | 'dirtjump';

export const CATEGORY: Record<Category, { label: string; plural: string; color: string }> = {
  dh: { label: 'Downhill racing', plural: 'Downhill', color: 'var(--cat-dh)' },
  slopestyle: { label: 'Slopestyle', plural: 'Slopestyle', color: 'var(--cat-slope)' },
  freeride: { label: 'Freeride / big air', plural: 'Freeride', color: 'var(--cat-free)' },
  dirtjump: { label: 'Dirt jump spot', plural: 'Dirt jumps', color: 'var(--cat-dj)' },
};

export interface LabLink {
  module: Exclude<ModuleId, 'menu'>;
  label: string;
  preset?: string;
}

export interface Venue {
  id: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  /** approximate altitude of the riding, m */
  altitude: number;
  cats: Category[];
  headline: string;
  /** what happened here in 2026 */
  facts: string[];
  /** the physics idea this place makes obvious */
  physics: string;
  labs: LabLink[];
  sources: { label: string; url: string }[];
}

const PB = 'https://www.pinkbike.com/news/';

export const VENUES: Venue[] = [
  /* ---------------- Downhill ---------------- */
  {
    id: 'val-di-sole', name: 'Val di Sole', place: 'Trentino, Italy', lat: 46.31, lon: 10.83, altitude: 1100, cats: ['dh'],
    headline: '2026 World Championships on the Black Snake',
    facts: [
      'Jackson Goldstone (CAN) kept the rainbow jersey in 3:28.785, 0.695 s ahead of Lachlan Stevens-McNab (NZL). Jordan Williams (GBR) was third, just 0.007 s further back.',
      'Valentina Höll (AUT) won a fifth straight elite world title in 4:01.558.',
      'The Black Snake drops about 540 m in 2.1 km.',
    ],
    physics: 'The average gradient is about 26%. On a slope that steep, gravity pulls you forward with a quarter of your weight, and your brakes have to fight that before they slow you at all.',
    labs: [{ module: 'race', label: 'Race the Black Snake', preset: 'val-di-sole' }, { module: 'braking', label: 'Braking basics' }],
    sources: [
      { label: 'UCI race report', url: 'https://www.uci.org/article/uci-mountain-bike-world-championships-hoell-and-goldstone-retain-downhill-titles-in-devastating-fashion/4f9QsRTm02r2iOwmXGs1W9' },
      { label: 'Results (Wikipedia, citing Tissot Timing)', url: 'https://en.wikipedia.org/wiki/2026_UCI_Mountain_Bike_World_Championships' },
    ],
  },
  {
    id: 'whistler', name: 'Whistler', place: 'British Columbia, Canada', lat: 50.11, lon: -122.95, altitude: 900, cats: ['dh', 'slopestyle'],
    headline: 'First-ever World Cup on 1199, and Joyride becomes Rhapsody',
    facts: [
      'Whistler hosted its first Downhill World Cup in September 2026 on the 1199 track (2.4 km, 489 m drop). Asa Vermette (USA) won in 3:23.930 and Valentina Höll won the women’s race.',
      'The track is named for the 1,199 World Cup points Stevie Smith scored in 2013.',
      'Red Bull Joyride was renamed Rhapsody Slopestyle. On 2 August Dawid Godziek topped the men’s scores with 94.50, ahead of Dane Folpp (92.50) and Tim Bringer (89.75). Johanna Nussbaumer won the women’s contest with 91.25.',
    ],
    physics: 'Two sports on one hill. Racers want to stay low and keep every joule as speed. Slopestyle riders trade speed for height, because airtime is what gives a trick room to finish.',
    labs: [{ module: 'race', label: 'Race 1199', preset: 'whistler-1199' }, { module: 'tricks', label: 'Spin a slopestyle trick', preset: '720' }],
    sources: [
      { label: 'Whistler: World Cup course facts', url: 'https://www.whistler.com/events/uci-mtb-world-cup/' },
      { label: 'Pinkbike: Whistler DH finals', url: `${PB}results-2026-whistler-dh-world-cup-elite-finals.html` },
      { label: 'Pinkbike: Rhapsody Slopestyle results', url: `${PB}results-rhapsody-slopestyle-crankworx-whistler-2026.html` },
      { label: 'Pinkbike: Joyride replaced by Rhapsody', url: `${PB}red-bull-joyride-is-no-more-replaced-by-new-rhapsody-slopestyle.html` },
    ],
  },
  {
    id: 'leogang', name: 'Leogang', place: 'Salzburg, Austria', lat: 47.44, lon: 12.72, altitude: 1050, cats: ['dh'],
    headline: 'A mud race on the Speedster',
    facts: [
      'Finn Iles (CAN) won in 3:15.647 by just 0.176 s. Valentina Höll won her home race in 3:44.033.',
      'Fastest speed trap: Dylan Maples at 66.3 km/h (41 mph).',
    ],
    physics: 'Mud lowers the friction between tire and ground. Cornering speed depends on the square root of grip, so half the grip still leaves about 70% of the corner speed.',
    labs: [{ module: 'race', label: 'Race the Speedster', preset: 'leogang' }, { module: 'cornering', label: 'Cornering basics' }],
    sources: [{ label: 'Pinkbike: Leogang race analysis', url: `${PB}race-analysis-mud-masterclass-and-a-dominant-win-at-the-2026-leogang-dh-world-cup.html` }],
  },
  {
    id: 'lenzerheide', name: 'Lenzerheide', place: 'Graubünden, Switzerland', lat: 46.73, lon: 9.56, altitude: 1700, cats: ['dh'],
    headline: 'Tight margins on the STRAIGHTline',
    facts: [
      'Anna Newkirk (USA) took her first elite World Cup win in 3:12.917, by 0.591 s.',
      'Fastest speed traps: Bode Burke 67.8 km/h, Valentina Höll 63.1 km/h.',
      'The men’s race was decided by 0.482 s.',
    ],
    physics: 'At 68 km/h a rider covers 18.8 m every second, so a 0.5 s winning margin is about 9 m of trail after three minutes of racing.',
    labs: [{ module: 'race', label: 'Open the Race Run Lab' }],
    sources: [{ label: 'Pinkbike: Lenzerheide race analysis', url: `${PB}race-analysis-razor-thin-margins-and-breakout-runs-at-the-2026-lenzerheide-dh-world-cup.html` }],
  },
  {
    id: 'les-gets', name: 'Les Gets', place: 'Haute-Savoie, France', lat: 46.16, lon: 6.67, altitude: 1400, cats: ['dh'],
    headline: 'A first World Cup win for Hattie Harnden',
    facts: [
      'Hattie Harnden (GBR) won her first Downhill World Cup in 4:11.966, by 1.232 s.',
      'The men’s winning time was 3:27.924.',
      'Fastest speed trap was only 52.9 km/h (Asa Vermette): a slow, technical track.',
    ],
    physics: 'Compare the speed traps: 53 km/h here, 68 km/h at Lenzerheide. Kinetic energy goes with speed squared, so the faster track means about 64% more energy to manage in every braking zone.',
    labs: [{ module: 'braking', label: 'Speed squared and braking' }],
    sources: [{ label: 'Pinkbike: Les Gets by the numbers', url: `${PB}analysis-the-numbers-behind-2-historic-wins-at-the-2026-les-gets-dh-world-cup.html` }],
  },
  {
    id: 'la-thuile', name: 'La Thuile', place: 'Aosta Valley, Italy', lat: 45.71, lon: 6.95, altitude: 1800, cats: ['dh'],
    headline: 'High speeds in the Aosta Valley',
    facts: ['Jordan Williams (GBR) won in 3:25.767 and Valentina Höll in 3:58.469.', 'Pinkbike’s sector analysis put Höll’s run 4.6 s off a “perfect lap” stitched from the best sectors.'],
    physics: 'A “perfect lap” adds up each rider’s best sectors. Nobody has ever ridden one, because pushing harder in one section costs entry speed or line in the next.',
    labs: [{ module: 'race', label: 'Open the Race Run Lab' }],
    sources: [{ label: 'Pinkbike: La Thuile race analysis', url: `${PB}race-analysis-high-speeds-and-long-awaited-wins-at-the-2026-la-thuile-dh-world-cup.html` }],
  },
  {
    id: 'loudenvielle', name: 'Loudenvielle', place: 'Pyrenees, France', lat: 42.8, lon: 0.41, altitude: 1300, cats: ['dh'],
    headline: 'Luca Shaw’s first elite win',
    facts: ['Luca Shaw (USA) took his first elite World Cup win in 3:27.637. Valentina Höll won in 3:51.920.'],
    physics: 'Shaw’s average speed works out from distance ÷ time. Average speed hides everything interesting: riders are constantly trading speed for height and back again.',
    labs: [{ module: 'race', label: 'Open the Race Run Lab' }],
    sources: [{ label: 'Pinkbike: Loudenvielle race analysis', url: `${PB}race-analysis-high-drama-and-breakout-performances-at-the-2026-loudenvielle-dh-world-cup.html` }],
  },
  {
    id: 'pal-arinsal', name: 'Pal Arinsal', place: 'Andorra', lat: 42.57, lon: 1.48, altitude: 1900, cats: ['dh'],
    headline: 'Thin air in the Pyrenees',
    facts: ['Valentina Höll and Jordan Williams won, and both led the overall standings into the summer break.'],
    physics: 'This is one of the highest tracks of the season. Air here is roughly 17% thinner than at sea level, so drag is about 17% lower at the same speed.',
    labs: [{ module: 'sendit', label: 'Try a jump in thin air', preset: 'slopestyle-booter' }],
    sources: [{ label: 'Pinkbike: Andorra race analysis', url: `${PB}race-analysis-high-speed-chaos-and-near-perfect-laps-at-the-2026-andorra-dh-world-cup.html` }],
  },
  {
    id: 'yongpyong', name: 'Mona YongPyong', place: 'PyeongChang, South Korea', lat: 37.64, lon: 128.68, altitude: 1000, cats: ['dh'],
    headline: 'Season opener: downhill returns to Asia',
    facts: ['The 2026 World Cup opened here, the first Downhill World Cup in Asia in 25 years.', 'Asa Vermette (USA) won the elite men’s race on his way to the overall title.'],
    physics: 'Gravity is not the same everywhere. At 37.6° north it is about 0.1% weaker than at Whistler’s 50° north, because Earth’s spin and bulge matter more near the equator.',
    labs: [{ module: 'race', label: 'Open the Race Run Lab' }],
    sources: [
      { label: 'UCI: new venues for 2026', url: 'https://www.ucimtbworldseries.com/news/iconic-new-venues-confirmed-for-2026-whoop-uci-mountain-bike-world-series' },
      { label: 'Pinkbike: 2026 season in review', url: `${PB}2026-world-cup-dh-season-in-review-tech-trends.html` },
    ],
  },
  {
    id: 'lake-placid', name: 'Lake Placid', place: 'New York, USA', lat: 44.37, lon: -73.9, altitude: 700, cats: ['dh'],
    headline: 'The finale: overall titles decided',
    facts: [
      'Luke Meier-Smith (AUS) won the final round by 1.394 s. Lisa Bouladou won the women’s race in 3:36.037.',
      'Asa Vermette (USA) and Valentina Höll (AUT) sealed the 2026 overall titles here.',
    ],
    physics: 'A season title is a sum of points, like a total is a sum of vectors: one race result rarely decides it, but consistency does.',
    labs: [{ module: 'race', label: 'Open the Race Run Lab' }],
    sources: [
      { label: 'Pinkbike: Lake Placid elite finals', url: `${PB}results-2026-lake-placid-dh-world-cup-elite-finals.html` },
      { label: 'Pinkbike: 2026 overall series winners', url: `${PB}who-are-the-2026-downhill-world-cup-overall-series-winners.html` },
    ],
  },
  {
    id: 'cypress', name: 'Cypress Mountain', place: 'British Columbia, Canada', lat: 49.4, lon: -123.2, altitude: 1000, cats: ['dh', 'freeride'],
    headline: 'Red Bull Hardline comes to BC',
    facts: [
      'The first Hardline in British Columbia ran on 16 October 2026 with 31 riders.',
      'Asa Vermette won his third Hardline in a row in 3:30.061, ahead of Lachlan Stevens-McNab and Oli Clark. Gracey Hemstreet won the women’s race.',
    ],
    physics: 'Hardline mixes race speed with freeride-size gaps. A racer cannot scrub speed in the air, so the speed at the lip decides everything about the landing.',
    labs: [{ module: 'sendit', label: 'Size up a big gap', preset: 'slopestyle-booter' }],
    sources: [{ label: 'Pinkbike: Hardline BC finals', url: `${PB}results-2026-red-bull-hardline-bc-finals.html` }, { label: 'Red Bull: race recap', url: 'https://www.redbull.com/gb-en/red-bull-hardline-british-columbia-race-recap' }],
  },

  /* ---------------- Slopestyle ---------------- */
  {
    id: 'christchurch', name: 'Christchurch Ōtautahi', place: 'Canterbury, New Zealand', lat: -43.59, lon: 172.6, altitude: 250, cats: ['slopestyle'],
    headline: 'The Slopestyle Super League begins',
    facts: ['Round one of the new Slopestyle Super League. Pinkbike reports Shealen Reno won the women’s final after a shootout and Erik Fedko won the men’s.'],
    physics: 'Every spin and flip is set at the lip. In the air there is nothing to push against, so angular momentum cannot change until the wheels touch down.',
    labs: [{ module: 'tricks', label: 'Open the Trick Lab', preset: '360' }],
    sources: [{ label: 'Pinkbike: SSL era begins', url: `${PB}history-is-made-as-slopestyle-super-league-era-begins-in-tautahi-christchurch.html` }],
  },
  {
    id: 'rotorua', name: 'Rotorua', place: 'Bay of Plenty, New Zealand', lat: -38.14, lon: 176.25, altitude: 350, cats: ['slopestyle'],
    headline: 'Crankworx Rotorua',
    facts: ['Dawid Godziek and Johanna Nussbaumer won the slopestyle. Nussbaumer went on to win Whistler too.'],
    physics: 'A slopestyle run links many jumps. Speed lost on one landing is speed missing at the next lip, so a slightly flat landing can end a run three features later.',
    labs: [{ module: 'tricks', label: 'Open the Trick Lab', preset: 'backflip' }],
    sources: [{ label: 'LW Mag: Rotorua 2026 results', url: 'https://lwmag.co.za/crankworx-slopestyle-rotorua-2026-replay-and-results' }],
  },
  {
    id: 'silverstar', name: 'SilverStar', place: 'British Columbia, Canada', lat: 50.36, lon: -119.06, altitude: 1600, cats: ['slopestyle'],
    headline: 'Super League playoffs',
    facts: ['Alma Wiggberg and Ben Thompson won. It was Thompson’s first Crankworx gold.', 'Wildfire smoke cancelled the downhill finals at the same festival.'],
    physics: 'At 1,600 m the air is about 15% thinner than at the coast. Riders feel slightly less drag in the run-in, which changes how much speed they carry to the lip.',
    labs: [{ module: 'sendit', label: 'Jump in thin air', preset: 'slopestyle-booter' }],
    sources: [{ label: 'Pinkbike: SilverStar slopestyle', url: `${PB}stakes-are-high-at-silverstar-slopestyle-with-alma-wiggberg-and-ben-thompson-grabbing-gold.html` }],
  },
  {
    id: 'mont-sainte-anne', name: 'Mont-Sainte-Anne', place: 'Québec, Canada', lat: 47.08, lon: -70.9, altitude: 300, cats: ['slopestyle'],
    headline: 'Super League finals: winner takes all',
    facts: ['Dawid Godziek and Johanna Nussbaumer won the season finals. Chance Moore and Shealen Reno were second.', 'Godziek and Reno had already won the regular-season points titles.'],
    physics: 'To double the rotations in the same airtime you need double the spin rate. That is why bigger tricks need bigger jumps as much as they need bigger snaps.',
    labs: [{ module: 'tricks', label: 'Try a 1080', preset: '1080' }],
    sources: [{ label: 'LW Mag: Mont-Sainte-Anne results', url: 'https://lwmag.co.za/crankworx-slopestyle-mont-sainte-anne-2026-replay-and-results' }, { label: 'Pinkbike: SSL finals roster', url: `${PB}roster-announced-for-slopestyle-super-league-finals-at-crankworx-mont-sainte-anne.html` }],
  },

  /* ---------------- Freeride ---------------- */
  {
    id: 'virgin', name: 'Virgin, Utah', place: 'Utah, USA', lat: 37.2, lon: -113.19, altitude: 1200, cats: ['freeride'],
    headline: 'Red Bull Rampage at 25: the wind wins',
    facts: [
      'Rampage returned to its original 2001 site for its 25th anniversary, with a higher start: about 206 m of vertical, the most of any Rampage venue.',
      'Robin Goomes (NZL) won the women’s event with 93.50, her third title in a row.',
      'High winds forced organizers to cancel the men’s final after nine first runs. Szymon Godziek was leading on 90.00, but there was no official winner.',
    ],
    physics: 'Drag depends on speed through the air, squared. A gust changes that airspeed in an instant, and on a big desert gap that can move the landing by meters.',
    labs: [{ module: 'sendit', label: 'Fly the canyon gap in a gust', preset: 'canyon-gap' }],
    sources: [
      { label: 'Red Bull: Rampage 2026 recap', url: 'https://www.redbull.com/int-en/red-bull-rampage-winner' },
      { label: 'Pinkbike: women’s finals results', url: `${PB}results-red-bull-rampage-2026-womens-finals.html` },
      { label: 'Singletracks: no men’s winner', url: 'https://www.singletracks.com/community/no-mens-winner-at-red-bull-rampage-2026/' },
      { label: 'Bikerumor: return to the 2001 venue', url: 'https://bikerumor.com/back-where-it-all-began-red-bull-rampage-returns-to-original-2001-venue-for-25th-anniversary/' },
    ],
  },
  {
    id: 'darkfest', name: 'Darkfest', place: 'Stellenbosch, South Africa', lat: -33.93, lon: 18.86, altitude: 250, cats: ['freeride', 'dirtjump'],
    headline: 'Ten years of the world’s biggest jumps',
    facts: [
      'The tenth Darkfest kept its famous 110 ft (33.5 m) gap.',
      'The new “Falcon Heavy” is a 20 m double with a 53° takeoff, hit at about 70 km/h, billed as the biggest-airtime jump ever built for mountain bikes.',
      'Elias Ruso landed a double flip on it. Alessio Tonoli and Natasha Bradley were named King and Queen of Darkness.',
    ],
    physics: 'A 53° lip sends most of the speed upward. Vertical speed sets airtime (t = 2·vy / g), which is why the Falcon Heavy has more hang time than the longer 110-footer.',
    labs: [{ module: 'sendit', label: 'Fly the Falcon Heavy', preset: 'falcon-heavy' }, { module: 'sendit', label: 'Clear the 110-footer', preset: 'darkfest-110' }],
    sources: [
      { label: 'BIKE Magazin: Darkfest 2026 interview', url: 'https://www.bike-magazin.de/en/about-us/magazine/backgrounds/darkfest-2026-between-world-record-and-fear/' },
      { label: 'BikeMag: 10 years of Darkfest', url: 'https://www.bikemag.com/news/10-years-of-darkfest-2026-results-from-the-worlds-biggest-jumps' },
    ],
  },

  /* ---------------- Dirt jump spots ---------------- */
  {
    id: 'gorge-road', name: 'Gorge Road Jump Park', place: 'Queenstown, New Zealand', lat: -45.02, lon: 168.66, altitude: 330, cats: ['dirtjump'],
    headline: '“The best dirt jumps in the world”',
    facts: [
      'More than 40 jumps, with lines from beginner to pro. Free to ride and maintained by the Queenstown Mountain Bike Club.',
      'Open from mid-November to May, and closed after rain to protect the dirt.',
      'Pro rider Matt Jones called these the best dirt jumps in the world.',
    ],
    physics: 'On a well-built set you barely brake or pedal. Each landing gives back almost all the speed the takeoff borrowed, and pumping the transitions tops up the small losses.',
    labs: [{ module: 'sendit', label: 'Ride a dirt jump set', preset: 'dirt-jump' }, { module: 'jump', label: 'Jump Lab basics' }],
    sources: [
      { label: 'Queenstown MTB Club: Gorge Road', url: 'https://www.queenstownmtb.co.nz/gorgeroadjumppark' },
      { label: 'BikeMag: “best dirt jumps in the world”', url: 'https://www.bikemag.com/news/best-dirt-jumps-world' },
    ],
  },
  {
    id: 'la-poma', name: 'La Poma Bike Park', place: 'Premià de Dalt, Barcelona, Spain', lat: 41.5, lon: 2.35, altitude: 140, cats: ['dirtjump'],
    headline: 'Europe’s year-round jump school',
    facts: ['A dirt-jump and pump-track park in the hills above the coast near Barcelona, ridden year-round thanks to the dry Mediterranean climate.', 'Well known among European slopestyle and dirt-jump riders.'],
    physics: 'Near sea level the air is at its densest. Drag is small at dirt-jump speeds, but it is never zero: compare this park with Valmont, 1,500 m higher.',
    labs: [{ module: 'sendit', label: 'Ride a dirt jump set', preset: 'dirt-jump' }, { module: 'tricks', label: 'Learn a 360', preset: '360' }],
    sources: [{ label: 'Video tour: “World’s best dirt jump bike park?”', url: 'https://www.youtube.com/watch?v=hazClg52G_4' }],
  },
  {
    id: 'valmont', name: 'Valmont Bike Park', place: 'Boulder, Colorado, USA', lat: 40.03, lon: -105.23, altitude: 1600, cats: ['dirtjump'],
    headline: 'A mile-high public park',
    facts: ['A free city-run bike park with dirt jumps and a large slopestyle course, often called the gold standard for municipal bike parks.'],
    physics: 'Boulder sits about 1,600 m up. The air is roughly 15% thinner than at the coast, so the same jump at the same speed carries a touch further.',
    labs: [{ module: 'sendit', label: 'Jump at altitude', preset: 'dirt-jump' }],
    sources: [{ label: 'COMBA: Colorado bike parks', url: 'https://www.comba.org/bikeparks' }],
  },
];

export const getVenue = (id: string | null | undefined) => VENUES.find((v) => v.id === id) ?? null;

export const SEASON_HEADLINES = [
  { label: 'DH World Cup overall', value: 'Asa Vermette · Valentina Höll' },
  { label: 'DH world champions', value: 'Jackson Goldstone · Valentina Höll' },
  { label: 'Slopestyle Super League', value: 'Dawid Godziek · Johanna Nussbaumer' },
  { label: 'Red Bull Rampage', value: 'Robin Goomes · men’s final cancelled (wind)' },
];
