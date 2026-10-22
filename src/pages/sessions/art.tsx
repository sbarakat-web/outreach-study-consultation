import { useState, type ReactNode } from "react";

/** <img> that swaps to `fallback` when the file is missing (photos are dropped into public/ later). */
export function SmartImage({ src, alt, className, fallback }: { src: string; alt: string; className?: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

/** Built-in Malta scene used until the hero illustration files are added. */
export function MaltaScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label="Malta harbour at sunrise">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#77c9f2" />
          <stop offset="0.7" stopColor="#bfe6fa" />
          <stop offset="1" stopColor="#fde7c3" />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f8fcf" />
          <stop offset="1" stopColor="#0b4f8a" />
        </linearGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d9a4" />
          <stop offset="1" stopColor="#d9b375" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <circle cx="1270" cy="210" r="90" fill="#fff4cf" opacity="0.9" />
      <g fill="#ffffff" opacity="0.8">
        <ellipse cx="300" cy="170" rx="120" ry="26" />
        <ellipse cx="380" cy="150" rx="80" ry="22" />
        <ellipse cx="980" cy="120" rx="100" ry="20" />
      </g>
      {/* Limestone city: walls, houses, church domes */}
      <path d="M0 560 L0 470 L120 470 L120 430 L260 430 L260 455 L400 455 L400 400 L520 400 L520 440 L700 440 L700 420 L860 420 L860 470 L1010 470 L1010 430 L1160 430 L1160 460 L1320 460 L1320 410 L1460 410 L1460 450 L1600 450 L1600 560 Z" fill="url(#stone)" />
      <g fill="#e8c88c">
        <rect x="560" y="330" width="90" height="110" />
        <path d="M560 330 Q605 260 650 330 Z" />
        <rect x="598" y="250" width="14" height="30" />
        <rect x="1180" y="350" width="80" height="80" />
        <path d="M1180 350 Q1220 290 1260 350 Z" />
      </g>
      <g fill="#c99a55" opacity="0.55">
        {Array.from({ length: 26 }, (_, i) => (
          <rect key={i} x={20 + i * 61} y={480 + (i % 3) * 18} width="16" height="22" rx="3" />
        ))}
      </g>
      <path d="M0 540 L1600 540 L1600 900 L0 900 Z" fill="url(#sea)" />
      <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.35">
        <path d="M120 620 h120 M420 680 h160 M900 640 h140 M1200 720 h180 M300 790 h120 M760 820 h160" />
      </g>
      {/* Luzzu boats */}
      <g>
        <path d="M980 700 Q1060 740 1140 700 L1125 735 Q1060 755 995 735 Z" fill="#d91c2b" />
        <path d="M995 712 Q1060 735 1125 712" stroke="#ffd166" strokeWidth="5" fill="none" />
        <path d="M380 740 Q440 770 500 740 L490 765 Q440 780 390 765 Z" fill="#078bc7" />
        <path d="M390 750 Q440 768 490 750" stroke="#ffd166" strokeWidth="4" fill="none" />
      </g>
    </svg>
  );
}
