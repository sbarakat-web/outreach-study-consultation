// Captures UTM/referrer data on first page load so it can be stored with the request.
const KEY = "consultation_tracking";

export function captureTracking() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const data: Record<string, string> = {
      landing_page: window.location.href,
      referrer: document.referrer,
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    };
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
      const v = params.get(k);
      if (v) data[k] = v;
    }
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable — tracking is best-effort
  }
}

export function getTracking(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}
