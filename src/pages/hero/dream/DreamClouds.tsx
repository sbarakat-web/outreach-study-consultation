/**
 * Soft cloud bank that rises at the end of the Dream scene (and hands over to the Travel scene).
 * Pure SVG (no image request): blurred puffs, organic edges via turbulence, fading into navy at
 * the very bottom so the seam with the next scene stays invisible.
 */
const PUFFS_BACK = [
  [80, 250, 150], [300, 230, 170], [540, 255, 150], [760, 225, 180], [990, 250, 160], [1220, 235, 175], [1420, 255, 150],
];
const PUFFS_FRONT = [
  [0, 330, 170], [220, 310, 160], [450, 335, 190], [700, 315, 170], [930, 335, 190], [1170, 315, 170], [1400, 335, 180],
];

function Bank({ puffs, id, fill, opacity }: { puffs: number[][]; id: string; fill: string; opacity: number }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <filter id={id} x="-20%" y="-50%" width="140%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="60" result="d" />
          <feGaussianBlur in="d" stdDeviation="22" />
        </filter>
      </defs>
      <g filter={`url(#${id})`} fill={fill} opacity={opacity}>
        {puffs.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
        ))}
        <rect x="-100" y="340" width="1640" height="90" />
      </g>
    </svg>
  );
}

export function DreamClouds() {
  return (
    <div className="dream-clouds pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[70%]" aria-hidden>
      <div className="dream-clouds-back absolute inset-0">
        <Bank puffs={PUFFS_BACK} id="dream-cloud-back" fill="#e9e6ff" opacity={0.75} />
      </div>
      <div className="dream-clouds-front absolute inset-0">
        <Bank puffs={PUFFS_FRONT} id="dream-cloud-front" fill="#ffffff" opacity={0.95} />
      </div>
      {/* Seam into the next scene. */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-navy from-15% via-[#3b3580]/55 to-transparent" />
    </div>
  );
}
