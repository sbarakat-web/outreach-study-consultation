// Writes per-route copies of dist/index.html with that route's SEO tags baked in,
// so crawlers see the right title/canonical before JavaScript runs.
// Keep in sync with publicPages in src/components/SeoController.tsx.
import { readFileSync, writeFileSync } from "node:fs";

const ORIGIN = "https://consultation.outreachstudy.eu";

const pages = {
  "/onlinesessions": {
    file: "dist/onlinesessions.html",
    title: "Study in Malta Programmes, Fees & Visa Guide | Outreach",
    description: "Explore Malta study programmes, English courses, tuition fees, entry requirements, partner institutions and the student visa journey.",
  },
};

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`prerender-seo: ${label} not found in dist/index.html`);
  return html.replace(pattern, replacement);
}

const base = readFileSync("dist/index.html", "utf8");

for (const [path, page] of Object.entries(pages)) {
  const url = `${ORIGIN}${path}`;
  const title = escape(page.title);
  const description = escape(page.description);
  let html = base;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`, "title");
  html = replaceOnce(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`, "description");
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`, "canonical");
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`, "og:url");
  html = replaceOnce(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`, "og:title");
  html = replaceOnce(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`, "og:description");
  writeFileSync(page.file, html);
  console.log(`prerender-seo: wrote ${page.file}`);
}
