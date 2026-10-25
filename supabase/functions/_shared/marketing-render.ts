// Marketing email renderer shared by the edge functions and the admin preview (no Deno/browser APIs).
// Blocks → brand layout (same purple bar + logo as the call emails) + designed footer, plus a
// plain-text version, personalisation tags with fallbacks and a simple spam check.

export const BRAND = "#442DFA";
const INK = "#14123a";
const MUTED = "#5b6080";

export type Block =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; url: string; alt: string; href?: string }
  | { id: string; type: "button"; label: string; href: string }
  | { id: string; type: "columns"; image: string; alt: string; text: string; href?: string; imageRight?: boolean }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; size: number }
  | { id: string; type: "quote"; text: string; author: string }
  | { id: string; type: "programme"; image: string; alt: string; name: string; price: string; href: string; label?: string };

export type BlockType = Block["type"];

export interface MarketingSettings {
  company_name: string;
  address: string;
  website_url: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  linkedin_url: string;
  youtube_url: string;
  why_text: string;
}

/** "https://www.outreachstudy.eu/" → "outreachstudy.eu" */
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
/** Footer contact links (website, email, phone, WhatsApp) for the HTML and plain-text versions. */
function contacts(s: MarketingSettings) {
  const out: { icon: string; label: string; href: string }[] = [];
  const web = safeUrl(s.website_url ?? "");
  if (web) out.push({ icon: "website", label: shortUrl(web), href: web });
  const mail = (s.contact_email ?? "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) out.push({ icon: "email", label: mail, href: `mailto:${mail}` });
  const tel = (s.phone ?? "").replace(/[^\d+]/g, "");
  if (tel) out.push({ icon: "phone", label: s.phone.trim(), href: `tel:${tel}` });
  const wa = (s.whatsapp ?? "").replace(/\D/g, "");
  if (wa) out.push({ icon: "whatsapp", label: `WhatsApp +${wa}`, href: `https://wa.me/${wa}` });
  return out;
}

export interface RenderInput {
  blocks: Block[];
  preheader?: string | null;
  settings: MarketingSettings;
  vars: Record<string, string | null | undefined>;
  appUrl: string;
  links: { unsubscribe: string; preferences: string; open?: string; wrap?: (url: string) => string };
}

/** Tags admins can use; `{tag|fallback}` overrides the default fallback. */
export const TAGS: { tag: string; label: string; fallback: string }[] = [
  { tag: "name", label: "First name", fallback: "there" },
  { tag: "course", label: "Course", fallback: "your studies" },
  { tag: "country", label: "Country", fallback: "your country" },
  { tag: "advisor", label: "Advisor", fallback: "the Outreach team" },
  { tag: "call_date", label: "Call date", fallback: "your next call" },
  { tag: "dashboard_link", label: "Dashboard link", fallback: "" },
  { tag: "signup_link", label: "Sign-up link", fallback: "" },
];

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function fillTags(text: string, vars: RenderInput["vars"], appUrl: string) {
  const defaults: Record<string, string> = Object.fromEntries(TAGS.map((t) => [t.tag, t.fallback]));
  defaults.dashboard_link = `${appUrl}/dashboard`;
  defaults.signup_link = appUrl;
  return text.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (whole, key: string, fallback?: string) => {
    const v = vars[key];
    if (v && String(v).trim()) return String(v);
    if (fallback !== undefined) return fallback;
    return key in defaults ? defaults[key] : whole;
  });
}

const safeUrl = (u: string) => (/^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : "");
/** Escaped text with line breaks and **bold**. */
const rich = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");

function renderBlock(b: Block, fill: (s: string) => string, link: (u: string) => string): string {
  const p = (inner: string, style = "") => `<tr><td style="padding:0 0 18px;${style}">${inner}</td></tr>`;
  switch (b.type) {
    case "heading":
      return p(`<h1 style="margin:0;text-align:center;font-size:26px;line-height:1.3;color:${INK}">${rich(fill(b.text))}</h1>`);
    case "text":
      return p(`<p style="margin:0;color:${MUTED};font-size:15px;line-height:1.7;text-align:center">${rich(fill(b.text))}</p>`);
    case "image": {
      const url = safeUrl(fill(b.url));
      if (!url) return "";
      const img = `<img src="${esc(url)}" alt="${esc(fill(b.alt || ""))}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:16px">`;
      const href = b.href ? safeUrl(fill(b.href)) : "";
      return p(href ? `<a href="${esc(link(href))}">${img}</a>` : img);
    }
    case "button": {
      const href = safeUrl(fill(b.href)) || "#";
      return p(
        `<a href="${esc(href === "#" ? href : link(href))}" style="display:inline-block;background:${BRAND};color:#ffffff;padding:14px 30px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px">${esc(fill(b.label))}</a>`,
        "text-align:center",
      );
    }
    case "columns": {
      const url = safeUrl(fill(b.image));
      const href = b.href ? safeUrl(fill(b.href)) : "";
      const img = url ? `<img src="${esc(url)}" alt="${esc(fill(b.alt || ""))}" width="250" style="display:block;width:100%;height:auto;border:0;border-radius:14px">` : "";
      const imgCell = `<td class="col" width="50%" valign="middle" style="padding:0 8px">${href && img ? `<a href="${esc(link(href))}">${img}</a>` : img}</td>`;
      const textCell = `<td class="col" width="50%" valign="middle" style="padding:0 8px;color:${MUTED};font-size:15px;line-height:1.7">${rich(fill(b.text))}</td>`;
      return p(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${b.imageRight ? textCell + imgCell : imgCell + textCell}</tr></table>`);
    }
    case "divider":
      return p(`<div style="height:1px;background:#e6e7f0;line-height:1px;font-size:0">&nbsp;</div>`);
    case "spacer":
      return `<tr><td style="height:${Math.max(4, Math.min(80, Number(b.size) || 24))}px;line-height:1px;font-size:0">&nbsp;</td></tr>`;
    case "quote":
      return p(
        `<div style="border-left:4px solid ${BRAND};background:#f6f5ff;border-radius:12px;padding:16px 18px"><p style="margin:0;color:${INK};font-size:16px;font-style:italic;line-height:1.6">“${rich(fill(b.text))}”</p>${
          b.author ? `<p style="margin:8px 0 0;color:#8a8ea8;font-size:13px">— ${esc(fill(b.author))}</p>` : ""
        }</div>`,
      );
    case "programme": {
      const url = safeUrl(fill(b.image));
      const href = safeUrl(fill(b.href));
      return p(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e7f0;border-radius:16px;overflow:hidden"><tr>${
          url ? `<td class="col" width="42%" style="padding:0"><img src="${esc(url)}" alt="${esc(fill(b.alt || b.name))}" width="220" style="display:block;width:100%;height:auto;border:0"></td>` : ""
        }<td class="col pad" style="padding:16px 18px"><p style="margin:0;color:${INK};font-size:17px;font-weight:bold">${esc(fill(b.name))}</p><p style="margin:4px 0 12px;color:${MUTED};font-size:14px">${esc(fill(b.price))}</p>${
          href ? `<a href="${esc(link(href))}" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">${esc(fill(b.label || "Apply"))}</a>` : ""
        }</td></tr></table>`,
      );
    }
  }
}

function footer(i: RenderInput) {
  const s = i.settings;
  const company = s.company_name?.trim() || "Outreach — Study in Malta";
  const icon = (href: string, name: string) =>
    href ? `<a href="${esc(href)}" style="display:inline-block;margin:0 5px"><img src="${i.appUrl}/email/${name}.png" alt="${name}" width="28" height="28" style="display:block;border:0"></a>` : "";
  const wa = s.whatsapp.replace(/\D/g, "");
  const icons = [
    icon(safeUrl(s.instagram_url), "instagram"),
    icon(safeUrl(s.facebook_url), "facebook"),
    icon(safeUrl(s.tiktok_url), "tiktok"),
    icon(safeUrl(s.linkedin_url ?? ""), "linkedin"),
    icon(safeUrl(s.youtube_url ?? ""), "youtube"),
    wa ? icon(`https://wa.me/${wa}`, "whatsapp") : "",
  ].join("");
  const contactLinks = contacts(s)
    .map(
      (c) =>
        `<a href="${esc(c.href)}" style="display:inline-block;margin:3px 8px;color:#5b6080;text-decoration:none;white-space:nowrap"><img src="${i.appUrl}/email/${c.icon}.png" alt="" width="16" height="16" style="display:inline-block;vertical-align:-3px;border:0;margin-right:5px">${esc(c.label)}</a>`,
    )
    .join("");
  return `<tr><td align="center" style="padding:26px 28px;background:#f8f8fc;color:#8a8ea8;font-size:12px;line-height:1.7">
    <img src="${i.appUrl}/email/logo-grey.png" alt="${esc(company)}" width="140" style="display:block;margin:0 auto 12px;border:0;width:140px;height:auto">
    ${icons ? `<div style="margin:0 0 12px">${icons}</div>` : ""}
    ${contactLinks ? `<div style="margin:0 0 10px;font-size:13px">${contactLinks}</div>` : ""}
    <div style="color:#5b6080;font-weight:bold">${esc(company)}</div>
    ${s.address ? `<div>${esc(s.address)}</div>` : ""}
    <div style="margin-top:8px">${esc(s.why_text)}</div>
    <div style="margin-top:8px"><a href="${esc(i.links.unsubscribe)}" style="color:#5b6080;text-decoration:underline">Unsubscribe</a> &nbsp;·&nbsp; <a href="${esc(i.links.preferences)}" style="color:#5b6080;text-decoration:underline">Manage preferences</a></div>
  </td></tr>`;
}

export function renderEmail(i: RenderInput): { html: string; text: string } {
  const fill = (s: string) => fillTags(s ?? "", i.vars, i.appUrl);
  const link = i.links.wrap ?? ((u: string) => u);
  const body = i.blocks.map((b) => renderBlock(b, fill, link)).join("");
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<style>@media (max-width:540px){.col{display:block!important;width:100%!important;padding:0 0 12px!important}.pad{padding:14px 16px!important}}</style></head>
<body style="margin:0;padding:0;background:#f4f5fb;-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(fill(i.preheader ?? ""))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
      <tr><td style="height:6px;background:${BRAND};line-height:6px;font-size:0">&nbsp;</td></tr>
      <tr><td align="center" style="padding:30px 28px 10px"><img src="${i.appUrl}/logo.png" alt="Outreach — Study in Malta" width="200" style="display:block;margin:0 auto;border:0;width:200px;max-width:70%;height:auto"></td></tr>
      <tr><td style="padding:18px 32px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr>
      ${footer(i)}
    </table>
  </td></tr>
</table>${i.links.open ? `<img src="${esc(i.links.open)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ""}</body></html>`;
  return { html, text: plainText(i, fill) };
}

function plainText(i: RenderInput, fill: (s: string) => string) {
  const lines: string[] = [];
  for (const b of i.blocks) {
    if (b.type === "heading") lines.push(fill(b.text).toUpperCase());
    else if (b.type === "text") lines.push(fill(b.text).replace(/\*\*/g, ""));
    else if (b.type === "button") lines.push(`${fill(b.label)}: ${fill(b.href)}`);
    else if (b.type === "image" && b.href) lines.push(`${fill(b.alt)}: ${fill(b.href)}`);
    else if (b.type === "columns") lines.push(fill(b.text).replace(/\*\*/g, ""));
    else if (b.type === "quote") lines.push(`"${fill(b.text)}"${b.author ? ` — ${fill(b.author)}` : ""}`);
    else if (b.type === "programme") lines.push(`${fill(b.name)} — ${fill(b.price)}${b.href ? `: ${fill(b.href)}` : ""}`);
    else if (b.type === "divider") lines.push("—");
  }
  const s = i.settings;
  lines.push("", s.company_name?.trim() || "Outreach — Study in Malta", ...contacts(s).map((c) => (c.icon === "website" || c.icon === "email" ? c.label : `${c.label} (${c.href})`)), s.address, s.why_text, `Unsubscribe: ${i.links.unsubscribe}`, `Manage preferences: ${i.links.preferences}`);
  return lines.filter((l) => l !== undefined).join("\n\n").replace(/\n{3,}/g, "\n\n");
}

export interface SpamIssue {
  level: "error" | "warn" | "ok";
  message: string;
}

/** Simple pre-send checks; score 0 (clean) … 10 (likely spam). */
export function spamCheck(subject: string, blocks: Block[], settings?: Partial<MarketingSettings>): { score: number; issues: SpamIssue[] } {
  const issues: SpamIssue[] = [];
  let score = 0;
  const images = blocks.filter((b) => b.type === "image" || b.type === "columns" || b.type === "programme");
  const noAlt = images.filter((b) => !("alt" in b) || !String(b.alt ?? "").trim());
  const words = blocks
    .map((b) => ("text" in b ? b.text : "") + " " + ("label" in b ? b.label ?? "" : ""))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  if (!subject.trim()) (score += 3), issues.push({ level: "error", message: "The subject is empty." });
  if (subject.length > 80) (score += 1), issues.push({ level: "warn", message: "The subject is long (over 80 characters) — it may be cut off on phones." });
  if (/[A-Z]{6,}/.test(subject) && subject === subject.toUpperCase()) (score += 2), issues.push({ level: "warn", message: "The subject is in CAPITALS." });
  if (/(!{2,}|\${2,}|100% free|act now|click here|winner|guarantee)/i.test(subject + " " + JSON.stringify(blocks)))
    (score += 2), issues.push({ level: "warn", message: "Spam-trigger words (e.g. “click here”, “!!!”, “act now”)." });
  if (noAlt.length) (score += 2), issues.push({ level: "warn", message: `${noAlt.length} image(s) without alt text — Gmail hides images by default.` });
  if (images.length > 3) (score += 1), issues.push({ level: "warn", message: "More than 3 images — keep emails mostly text." });
  if (images.length && words < 25) (score += 2), issues.push({ level: "warn", message: "Very little text compared with images." });
  if (!blocks.some((b) => b.type === "button")) issues.push({ level: "warn", message: "No button — add one clear call to action." });
  if (settings && !settings.address?.trim()) (score += 1), issues.push({ level: "warn", message: "No office address in the footer (Settings) — required for marketing email." });
  issues.push({ level: "ok", message: "Plain-text version is generated automatically." });
  issues.push({ level: "ok", message: "Unsubscribe link and one-click unsubscribe header included." });
  return { score: Math.min(10, score), issues };
}
