/**
 * Flight path geometry for the shared JourneyOverlay, in screen pixels (the overlay SVG uses
 * viewBox "0 0 w h", so nothing is stretched). Rebuilt on every ScrollTrigger refresh.
 *
 * The path is one continuous curve in three phases; FLIGHT_PHASES gives where each phase ends
 * along the path (0–1), so the airplane and the dotted trail stay in sync:
 *   takeoff  — from the airplane in the Dream photo, climbing while the Travel scene scrolls in
 *   cruise   — the wide arc across the Travel sky (desktop: while Travel is pinned)
 *   descent  — gently down towards the next scene (Malta, Step 5)
 */
export const FLIGHT_PHASES = { takeoff: 0.26, cruise: 0.78, descent: 1 };

export type Pt = { x: number; y: number };

/** The airplane image's own nose angle (it is drawn climbing to the right): rotation offset for autoRotate. */
export const PLANE_NOSE_DEG = 16;

const f = (w: number, h: number, x: number, y: number) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`;

/** Desktop / tablet: wide arc from the parked airplane, over the top of the sky, then a descent to the right. */
export function desktopPath(w: number, h: number, anchor: Pt | null): string {
  const a = anchor ?? { x: 0.38 * w, y: 0.6 * h };
  return [
    `M ${a.x.toFixed(1)} ${a.y.toFixed(1)}`,
    // takeoff: climb out of the clouds
    `C ${(a.x + 0.06 * w).toFixed(1)} ${(a.y - 0.04 * h).toFixed(1)}, ${f(w, h, 0.47, 0.42)}, ${f(w, h, 0.53, 0.34)}`,
    // cruise: wide, slow arc across the sky
    `C ${f(w, h, 0.6, 0.25)}, ${f(w, h, 0.7, 0.19)}, ${f(w, h, 0.8, 0.22)}`,
    // descent: easing down towards Malta, leaving the frame bottom-right
    `C ${f(w, h, 0.88, 0.23)}, ${f(w, h, 0.98, 0.28)}, ${f(w, h, 1.14, 0.38)}`,
  ].join(" ");
}

/** Phones: dedicated vertical climb (bottom-left → top-right), then a short descent off the right edge. */
export function mobilePath(w: number, h: number): string {
  return [
    `M ${f(w, h, -0.15, 0.92)}`,
    `C ${f(w, h, 0.1, 0.84)}, ${f(w, h, 0.25, 0.66)}, ${f(w, h, 0.42, 0.52)}`,
    `C ${f(w, h, 0.58, 0.38)}, ${f(w, h, 0.72, 0.24)}, ${f(w, h, 0.88, 0.22)}`,
    `C ${f(w, h, 1.0, 0.21)}, ${f(w, h, 1.1, 0.3)}, ${f(w, h, 1.25, 0.42)}`,
  ].join(" ");
}
