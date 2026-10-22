import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { captureTracking } from "./lib/tracking";
import "./index.css";

captureTracking();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
