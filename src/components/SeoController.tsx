import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://consultation.outreachstudy.eu";
const DEFAULT_IMAGE = `${ORIGIN}/onlinesessions/online-session-hero-v2.webp`;

const publicPages: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Study in Malta | Courses, Fees & Free Consultation | Outreach",
    description: "Study in Malta with Outreach. Compare English, diploma, bachelor's and master's courses, fees and requirements, then book a free consultation.",
  },
  "/onlinesessions": {
    title: "Study in Malta Programmes, Fees & Visa Guide | Outreach",
    description: "Explore Malta study programmes, English courses, tuition fees, entry requirements, partner institutions and the student visa journey.",
  },
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function SeoController() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const page = publicPages[pathname];
    const indexable = !!page && (pathname !== "/onlinesessions" || !search);
    const title = page?.title ?? "Private account | Outreach — Study in Malta";
    const description = page?.description ?? "Secure Outreach application and staff area.";
    const canonicalUrl = `${ORIGIN}${pathname === "/" ? "/" : pathname}`;

    document.title = title;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="robots"]', "name", "robots", indexable ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" : "noindex, nofollow");
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    setMeta('meta[property="og:image"]', "property", "og:image", DEFAULT_IMAGE);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [pathname, search]);

  return null;
}
