/**
 * Soft SVG cloud bank (no image request): blurred puffs with organic edges via turbulence.
 * Shared by the Dream cloud transition, the Travel sky layers and the overlay's front clouds.
 * `puffs` are [cx, cy, r] in a 1440×460 box; `base` adds a solid strip under them.
 */
export function CloudBank({
  puffs,
  id,
  fill = "#ffffff",
  opacity = 1,
  base,
  blur = 22,
  className = "absolute inset-0 h-full w-full",
}: {
  puffs: number[][];
  id: string;
  fill?: string;
  opacity?: number;
  base?: { y: number; h: number };
  blur?: number;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <filter id={id} x="-20%" y="-50%" width="140%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="60" result="d" />
          <feGaussianBlur in="d" stdDeviation={blur} />
        </filter>
      </defs>
      <g filter={`url(#${id})`} fill={fill} opacity={opacity}>
        {puffs.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
        {base && <rect x="-100" y={base.y} width="1640" height={base.h} />}
      </g>
    </svg>
  );
}

/** [left %, top %, width %, height %, opacity] inside the layer. */
export type Blob = [number, number, number, number, number];

/**
 * Soft clouds made of radial gradients — no SVG filter, so no filter-region edges and cheap to
 * composite while moving. Used for the Travel sky layers and the overlay's front clouds.
 */
export function SoftClouds({ blobs, tint = "255,255,255", className = "absolute inset-0" }: { blobs: Blob[]; tint?: string; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {blobs.map(([l, t, w, h, o], i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${l}%`,
            top: `${t}%`,
            width: `${w}%`,
            height: `${h}%`,
            background: `radial-gradient(closest-side, rgba(${tint},${o}) 0%, rgba(${tint},${o * 0.75}) 35%, rgba(${tint},${o * 0.3}) 65%, rgba(${tint},0) 100%)`,
          }}
        />
      ))}
    </div>
  );
}
