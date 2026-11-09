/**
 * The physics of *place*: how gravity and air change with where on Earth you ride.
 * SI units throughout.
 */

export const G0 = 9.80665; // standard gravity, m/s²
export const RHO0 = 1.225; // sea-level air density in the International Standard Atmosphere, kg/m³

/**
 * Local gravitational acceleration.
 * Latitude term: 1980 international gravity formula (Earth spins and is slightly flattened,
 * so g is ~0.5% larger at the poles than at the equator).
 * Altitude term: free-air correction, −3.086e-6 m/s² per meter of height.
 */
export function localGravity(latitudeDeg: number, altitudeM = 0): number {
  const phi = (latitudeDeg * Math.PI) / 180;
  const s = Math.sin(phi) ** 2;
  const s2 = Math.sin(2 * phi) ** 2;
  return 9.780327 * (1 + 0.0053024 * s - 0.0000058 * s2) - 3.086e-6 * altitudeM;
}

/**
 * Air density from altitude using the International Standard Atmosphere (troposphere):
 *   T = 288.15 − 0.0065·h      p = 101325·(T / 288.15)^5.25588      ρ = p / (R·T)
 * Pass tempC to use an actual air temperature with the standard pressure at that height
 * (hot desert air is thinner than cold alpine air at the same elevation).
 */
export function airDensity(altitudeM: number, tempC?: number): number {
  const h = Math.min(11000, Math.max(-500, altitudeM));
  const tStd = 288.15 - 0.0065 * h;
  const p = 101325 * Math.pow(tStd / 288.15, 5.25588);
  const t = tempC === undefined ? tStd : tempC + 273.15;
  return p / (287.05 * t);
}
