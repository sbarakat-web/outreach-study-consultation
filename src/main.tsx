import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { captureTracking } from "./lib/tracking";
import "./index.css";

captureTracking();

// Start the route-specific LCP request before React's lazy /hero bundle resolves.
if (window.location.pathname.replace(/\/$/, "") === "/hero") {
  const heroPreloads = [
    { href: "/hero/dream-mobile.webp", media: "(max-width: 767px)" },
    { href: "/hero/dream-portrait.webp", media: "(min-width: 768px) and (max-width: 1023px)" },
    { href: "/hero/dream-1024.webp", media: "(min-width: 1024px)" },
  ];

  for (const image of heroPreloads) {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.type = "image/webp";
    preload.href = image.href;
    preload.media = image.media;
    preload.fetchPriority = "high";
    document.head.append(preload);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
