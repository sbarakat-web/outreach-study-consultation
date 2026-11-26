/** Flag of Malta (white | red, with the George Cross in the canton), simplified for small sizes. */
export function MaltaFlag({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} role="img" aria-label="Flag of Malta">
      <rect width="15" height="20" fill="#fff" />
      <rect x="15" width="15" height="20" fill="#cf142b" />
      <g fill="#c4c4c4" stroke="#cf142b" strokeWidth="0.35">
        <path d="M3.4 1.6h1.8v1.6h1.6v1.8H5.2v1.6H3.4V5H1.8V3.2h1.6z" />
      </g>
    </svg>
  );
}
