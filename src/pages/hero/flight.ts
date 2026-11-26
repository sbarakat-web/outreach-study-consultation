/**
 * Flight path geometry for the shared JourneyOverlay, in screen pixels (the overlay SVG uses
 * viewBox "0 0 w h", so nothing is stretched). Rebuilt on every ScrollTrigger refresh.
 *
 * One continuous curve made of three legs. Each leg is also exposed on its own, so the airplane
 * can follow one leg per timeline phase while the dotted trail reveals the full path:
 *   takeoff — from the airplane in the Dream photo, climbing while the Travel scene scrolls in
 *   cruise  — the wide arc across the Travel sky (desktop: while Travel is pinned)
 *   descent — down onto Valletta in the Malta photo (desktop) / off the right edge (phones)
 * Then `next` is the journey line that leaves Malta towards the following scene (Study).
 */
export type Pt = { x: number; y: number };
type Leg = { c1: Pt; c2: Pt; to: Pt };
export type FlightGeometry = { full: string; legs: string[]; next: string | null; end: Pt };

/** The airplane image's own nose angle (it is drawn climbing to the right): rotation offset for autoRotate. */
export const PLANE_NOSE_DEG = 16;

const n = (v: number) => v.toFixed(1);
const ptStr = (p: Pt) => `${n(p.x)} ${n(p.y)}`;
const legStr = (l: Leg) => `C ${ptStr(l.c1)}, ${ptStr(l.c2)}, ${ptStr(l.to)}`;

function compose(start: Pt, legs: Leg[]) {
  let from = start;
  const parts: string[] = [];
  for (const l of legs) {
    parts.push(`M ${ptStr(from)} ${legStr(l)}`);
    from = l.to;
  }
  return { full: `M ${ptStr(start)} ${legs.map(legStr).join(" ")}`, legs: parts, end: from };
}

/** Desktop / tablet: takeoff from the parked airplane, wide arc over the sky, landing approach onto Valletta. */
export function desktopFlight(w: number, h: number, takeoff: Pt | null, malta: Pt | null): FlightGeometry {
  const P = (x: number, y: number): Pt => ({ x: x * w, y: y * h });
  const a = takeoff ?? P(0.38, 0.6);
  const m = malta ?? P(0.8, 0.38);
  // End of the cruise: low and far enough left that the descent stays shallow (≈20–30°).
  const c = P(0.63, 0.235);
  const g = compose(a, [
    { c1: { x: a.x + 0.06 * w, y: a.y - 0.04 * h }, c2: P(0.47, 0.42), to: P(0.53, 0.34) },
    { c1: P(0.585, 0.267), c2: P(0.6, 0.235), to: c },
    // descent: a smooth, shallow approach onto the destination marker (controls along the glide slope)
    { c1: { x: c.x + 0.33 * (m.x - c.x), y: c.y + 0.2 * (m.y - c.y) }, c2: { x: c.x + 0.66 * (m.x - c.x), y: c.y + 0.7 * (m.y - c.y) }, to: m },
  ]);
  // Journey line onwards: from Malta, sweeping down and out of the bottom towards the next scene.
  // Kept on the right-hand side so it never crosses the headline (bottom-left).
  const next = `M ${ptStr(m)} C ${ptStr({ x: m.x + 0.02 * w, y: m.y + 0.2 * h })}, ${ptStr(P(0.8, 0.75))}, ${ptStr(P(0.74, 1.08))}`;
  return { ...g, next };
}

/** Phones: dedicated vertical climb (bottom-left → top-right), then a short descent off the right edge. */
export function mobileFlight(w: number, h: number): FlightGeometry {
  const P = (x: number, y: number): Pt => ({ x: x * w, y: y * h });
  const g = compose(P(-0.15, 0.92), [
    { c1: P(0.1, 0.84), c2: P(0.25, 0.66), to: P(0.42, 0.52) },
    { c1: P(0.58, 0.38), c2: P(0.72, 0.24), to: P(0.88, 0.22) },
    { c1: P(1.0, 0.21), c2: P(1.1, 0.3), to: P(1.25, 0.42) },
  ]);
  return { ...g, next: null };
}
