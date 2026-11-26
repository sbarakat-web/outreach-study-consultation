/**
 * Shared, fixed layer above every scene for the future journey animation:
 * flight path (SVG), clouds and the airplane. Empty and inert for now; Step 3 animates it.
 * Add ?debug=overlay to the URL to outline the layers while developing.
 */
export function JourneyOverlay() {
  const debug = new URLSearchParams(window.location.search).get("debug") === "overlay";
  const outline = debug ? "outline outline-1 outline-dashed outline-amber-300/60" : "";

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden data-layer="journey-overlay">
      <svg
        data-layer="flight-path"
        className={`absolute inset-0 h-full w-full ${outline}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* <path id="flight-path" d="…" /> — drawn in Step 3 */}
      </svg>
      <div data-layer="clouds" className={`absolute inset-0 ${outline}`} />
      <div data-layer="airplane" className={`absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 ${outline}`} />
    </div>
  );
}
