// Outreach email brand layout (shared by all functions): centred logo, #442DFA accents,
// table-based markup so it renders in Gmail, Outlook and mobile mail apps.
export const BRAND = "#442DFA";
export const INK = "#14123a";
export const MUTED = "#5b6080";

const appUrl = () => Deno.env.get("APP_URL") || "https://consultation.outreachstudy.eu";

export const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Full email: preheader (inbox preview), centred logo, content card and footer. `lang` "ar" turns it right-to-left.
 * `site` replaces the website link in the footer (staff emails use the recruitment site).
 */
export function layout(inner: string, preheader = "", lang = "en", site = { url: "https://outreachstudy.eu", label: "outreachstudy.eu" }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (dir === "rtl") inner = inner.replaceAll("letter-spacing:1.5px;", "").replaceAll("letter-spacing:1px;", ""); // spacing breaks Arabic letter joins
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f5fb;-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
      <tr><td style="height:6px;background:${BRAND};line-height:6px;font-size:0">&nbsp;</td></tr>
      <tr><td align="center" style="padding:30px 28px 6px">
        <img src="${appUrl()}/logo.png" alt="Outreach — Study in Malta" width="200" style="display:block;margin:0 auto;border:0;width:200px;max-width:70%;height:auto">
      </td></tr>
      <tr><td dir="${dir}" style="padding:18px 28px 30px;color:${INK};font-size:15px;line-height:1.65">${inner}</td></tr>
      <tr><td align="center" style="padding:20px 28px;background:#f8f8fc;color:#8a8ea8;font-size:12px;line-height:1.7">
        <strong style="color:${INK}">Outreach — Study in Malta</strong><br>
        <a href="${site.url}" style="color:${BRAND};text-decoration:none">${escape(site.label)}</a> &nbsp;·&nbsp;
        <a href="https://wa.me/35699728213" style="color:${BRAND};text-decoration:none">WhatsApp +356 9972 8213</a>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

export const eyebrow = (text: string) =>
  `<p style="margin:0 0 6px;text-align:center;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND}">${escape(text)}</p>`;

export const title = (text: string) => `<h1 style="margin:0 0 14px;text-align:center;font-size:24px;line-height:1.3;color:${INK}">${text}</h1>`;

export const para = (html: string, center = false) => `<p style="margin:0 0 14px;color:${MUTED};${center ? "text-align:center;" : ""}">${html}</p>`;

export const button = (href: string, label: string, color = BRAND) =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px;margin:4px 4px">${escape(label)}</a>`;

/** Centred row of buttons. */
export const actions = (...buttons: string[]) => `<p style="margin:22px 0;text-align:center">${buttons.filter(Boolean).join(" ")}</p>`;

/** Light brand box for key facts (time, programme, code…). */
export const highlight = (html: string) =>
  `<div style="margin:0 0 16px;padding:16px 18px;background:#f0eeff;border-radius:14px;text-align:center;color:${INK}">${html}</div>`;

export const facts = (rows: [string, string | null | undefined][]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:14px">${rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#8a8ea8;white-space:nowrap;vertical-align:top">${escape(k)}</td><td style="padding:6px 0;color:${INK}"><strong>${escape(v!)}</strong></td></tr>`,
    )
    .join("")}</table>`;

export const list = (items: string[]) =>
  `<ol style="margin:0 0 16px;padding-left:20px;color:${MUTED}">${items.map((i) => `<li style="margin:4px 0">${escape(i)}</li>`).join("")}</ol>`;

/** Advisor card: round photo (or initial) + "Your call with …". */
export const advisorCard = (line: string, role: string, name: string, photoUrl?: string | null) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px"><tr>
    <td style="padding:0 10px">${
      photoUrl
        ? `<img src="${escape(photoUrl)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;object-fit:cover;border:0">`
        : `<div style="width:48px;height:48px;border-radius:50%;background:${BRAND};color:#fff;font-weight:bold;font-size:20px;line-height:48px;text-align:center">${escape(name.slice(0, 1).toUpperCase())}</div>`
    }</td>
    <td style="padding:0 10px;font-size:14px;line-height:1.4"><strong style="color:${INK}">${escape(line)}</strong><br><span style="color:#8a8ea8;font-size:13px">${escape(role)}</span></td>
  </tr></table>`;

/** "What happens next": three numbered steps in a row (wraps on small screens). */
export const steps = (heading: string, items: string[]) =>
  `<div style="margin:6px 0 18px;padding:14px 16px;border:2px solid #f0eeff;border-radius:14px;text-align:center">
    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#8a8ea8">${escape(heading)}</p>
    <p style="margin:0;font-size:14px;color:${INK}">${items
      .map((s, i) => `<span style="display:inline-block;margin:3px 6px;white-space:nowrap"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${BRAND};color:#fff;font-size:12px;font-weight:bold;line-height:22px;text-align:center">${i + 1}</span> ${escape(s)}</span>`)
      .join(`<span style="color:#c7c9d9">→</span>`)}</p>
  </div>`;
