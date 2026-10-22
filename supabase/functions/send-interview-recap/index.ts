// Recap after an "Interviewed" online session: emails the student a one-click dashboard
// sign-in link, the documents to prepare and the personalised presentation PDF, and
// returns a WhatsApp link with a short version of the same message.
// Caller must be a signed-in admin or session presenter.
//
// Secrets: RESEND_API_KEY; optional overrides MAIL_FROM, APP_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { actions, button, eyebrow, facts, layout, list, para, title, escape } from "../_shared/email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const env = (k: string) => Deno.env.get(k) ?? "";
const DEFAULTS: Record<string, string> = {
  MAIL_FROM: "Outreach <hello@consultation.outreachstudy.eu>",
  APP_URL: "https://consultation.outreachstudy.eu",
};
const setting = (k: string) => env(k) || DEFAULTS[k] || "";

const DOCUMENTS = [
  "Updated CV",
  "Passport copy",
  "Certificates for your chosen course",
  "IELTS evidence according to the course requirement",
  "A 300-word personal statement explaining your reasons for study",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const { applicationId, programme, school, englishRequirement, presentationPdfBase64, presentationPdfFilename } = body;
  if (typeof applicationId !== "string") return json({ error: "applicationId required" }, 400);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  // Caller: confirmed email listed as admin or session presenter.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(jwt);
  const caller = auth?.user;
  if (!caller?.email || !caller.email_confirmed_at) return json({ error: "Not signed in" }, 401);
  const email = caller.email.toLowerCase();
  const [{ data: admin }, { data: presenter }] = await Promise.all([
    db.from("admins").select("email").eq("email", email).maybeSingle(),
    db.from("session_presenters").select("email").eq("email", email).maybeSingle(),
  ]);
  if (!admin && !presenter) return json({ error: "Admin or session presenter role required" }, 403);

  const { data: c, error } = await db.from("consultations").select("id, full_name, email, whatsapp").eq("id", applicationId).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!c) return json({ error: "Candidate not found" }, 404);

  const appUrl = setting("APP_URL");
  const first = c.full_name.split(" ")[0];

  // One-click sign-in to the dashboard; falls back to the sign-in page.
  let dashboardLink = `${appUrl}/login?next=/dashboard`;
  const link = await db.auth.admin.generateLink({ type: "magiclink", email: c.email, options: { redirectTo: `${appUrl}/dashboard/documents` } });
  if (link.data?.properties?.action_link) dashboardLink = link.data.properties.action_link;

  const result: Record<string, unknown> = {};

  if (!env("RESEND_API_KEY")) {
    result.email = "not-configured";
  } else {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: setting("MAIL_FROM"),
        to: c.email,
        subject: `${first}, your Malta study dashboard is ready`,
        html: layout(
          eyebrow("Your study path") +
            title(`Hi ${escape(first)}, thank you for your session!`) +
            para("Here is a summary of your study path. Your personalised presentation is attached as a PDF.", true) +
            facts([
              ["Programme", programme],
              ["School", school],
              ["English requirement", englishRequirement],
            ]) +
            `<p style="margin:0 0 6px;color:#14123a"><strong>Please prepare these documents:</strong></p>` +
            list(DOCUMENTS) +
            actions(button(dashboardLink, "Open your dashboard")) +
            para("The button signs you in directly. Upload your documents in the Documents section.", true),
          `Your Malta study path${programme ? `: ${programme}` : ""}`,
        ),
        attachments:
          typeof presentationPdfBase64 === "string" && presentationPdfBase64
            ? [{ filename: presentationPdfFilename || "Malta-Study-Presentation.pdf", content: presentationPdfBase64 }]
            : undefined,
      }),
    });
    result.email = res.ok ? "sent" : await res.text();
  }

  const digits = (c.whatsapp ?? "").replace(/\D/g, "");
  if (digits) {
    const text = [
      `Hi ${first}, thank you for your Malta study session with Outreach!`,
      programme ? `Programme: ${programme}${school ? ` (${school})` : ""}` : "",
      englishRequirement ? `English requirement: ${englishRequirement}` : "",
      `Please prepare: ${DOCUMENTS.join("; ")}.`,
      `We've emailed you the presentation PDF and your dashboard link: ${appUrl}/dashboard`,
    ]
      .filter(Boolean)
      .join("\n");
    result.waUrl = `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
  }

  return json({ ok: result.email === "sent", ...result });
});
