// Uploads the branded auth email templates to Supabase (Auth → Email Templates).
// Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-email-templates.mjs
// Create the token at https://supabase.com/dashboard/account/tokens (account that owns the project).
import { readFileSync } from "node:fs";

const PROJECT_REF = "qkcdjqrtwzqflrrxdgqw";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN first (https://supabase.com/dashboard/account/tokens).");
  process.exit(1);
}

const read = (name) => readFileSync(new URL(`../supabase/templates/${name}`, import.meta.url), "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    mailer_subjects_confirmation: "Confirm your email to access your Outreach Study dashboard",
    mailer_templates_confirmation_content: read("confirm-signup.html"),
    mailer_subjects_magic_link: "Your Outreach sign-in code: {{ .Token }}",
    mailer_templates_magic_link_content: read("magic-link.html"),
  }),
});

if (!res.ok) {
  console.error(`Failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log("Email templates updated: Confirm signup + Magic Link.");
