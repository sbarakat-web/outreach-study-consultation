# Consultation app — consultation.outreachstudy.eu

Candidates book a free study consultation through a 5-step form (no popup); admins manage requests, time slots and the team.

**Candidates**
- `/` — Path → English level → Details → Pick a time → Create account & confirm
- `/dashboard` — their requests, booked time, progress, and document uploads
- Confirmation email (and optional WhatsApp) after booking

**Admins**
- `/admin` — all requests: search, filter by CRM stage, details, status, internal notes, documents, WhatsApp/email shortcuts
- `/admin/slots` — create availability in bulk (date range × hours × weekdays), delete or free slots
- `/admin/team` — add or remove admins by email

Stack: Vite + React + TypeScript + Tailwind, and Supabase (Auth, Postgres with RLS, Storage, one Edge Function).

## 1. Supabase

1. Use a Supabase project (create one, or reuse an existing one). In this folder:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push   # applies supabase/migrations/*.sql
   ```
2. **Auth → Providers → Email**: keep **Confirm email** turned ON. Admin rights depend on a confirmed email.
3. **Auth → URL Configuration**: set Site URL to `https://consultation.outreachstudy.eu` and add these redirect URLs:
   `https://consultation.outreachstudy.eu/**` and `http://localhost:5173/**`.
4. **Make yourself the first admin.** In the SQL editor:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
   Then create an account at `/login` with that email and confirm it. Add other admins from `/admin/team`.
5. **Email templates (one email with a code).** With custom SMTP enabled, upload the branded templates in `supabase/templates/`. The Confirm signup template is used for new applicants and admin-added leads; it asks recipients to confirm their email and open their dashboard:
   `SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-email-templates.mjs` (token from https://supabase.com/dashboard/account/tokens).
   Or paste `confirm-signup.html` into **Confirm signup** and `magic-link.html` into **Magic Link** by hand.
6. Optional: set Supabase Auth to send email through your own SMTP (Auth → SMTP) so that sign-up emails come from your domain.

## 2. Confirmation emails / WhatsApp (Edge Function)

Create a [Resend](https://resend.com) account, verify `consultation.outreachstudy.eu`, then run:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  MAIL_FROM="Outreach <hello@consultation.outreachstudy.eu>" \
  ADMIN_NOTIFY_EMAIL=you@example.com \
  APP_URL=https://consultation.outreachstudy.eu
supabase functions deploy send-confirmation --no-verify-jwt
```

WhatsApp messages are sent through Twilio, and only if these secrets are set: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (e.g. `+14155238886`). For production, WhatsApp requires an approved sender and message template. Without Twilio, candidates still get the email and a "Chat on WhatsApp" button (`VITE_WHATSAPP_NUMBER`).

## 3. Run locally

```bash
cp .env.example .env    # fill in URL, anon/publishable key, WhatsApp number
npm install
npm run dev             # http://localhost:5173
```

## 4. Deploy to consultation.outreachstudy.eu

The app is a static site (`npm run build` → `dist/`). SPA rewrites are already included for Vercel (`vercel.json`) and Netlify (`public/_redirects`).

**Vercel** (example): import the GitHub repo, add the three `VITE_*` env vars, and deploy. Then go to Settings → Domains, add `consultation.outreachstudy.eu`, and create the DNS record Vercel shows you at your domain registrar (usually `CNAME consultation → cname.vercel-dns.com`).

## Pre-filled links

`?path=english` or `?path=b2` skips the first question; `&course=IT` (also `business`, `accountancy`, `health`, `logistics`, `tourism`) preselects the programme. UTM parameters are saved with each application.

## Test checklist

- [ ] As a visitor, complete all 5 steps and pick a slot → success screen; the slot disappears for other visitors
- [ ] Confirmation email arrives (candidate + admin)
- [ ] Click the confirmation link → `/dashboard` shows the request and the booked time; uploading a PDF works
- [ ] A second account can't see the first account's requests or documents
- [ ] As an admin: change status and notes, open a document, free a slot, add/delete slots, add an admin
- [ ] A non-admin who opens `/admin` is redirected to `/dashboard`

## Online Study Session (`/onlinesessions`)

Guided 7-chapter presentation advisers run live with booked candidates (also open to students).

- Public: `/onlinesessions` · personalised: `/onlinesessions?stage=interviewed&programme=<name>` · presenter: `/onlinesessions?present=1[&candidate=<id>]`
- Presenter access: admins, or emails in **Admin → Team → Session presenters** (they only see booked/interviewed candidates and record outcomes via `mark_candidate_interviewed` / `mark_candidate_session_outcome`).
- "Booked" = call confirmed in Admin. Outcomes: Interviewed → Documents requested (+ PDF recap email via `send-interview-recap`), No attendance → call reset so the candidate rebooks, No longer interested → Lost.
- Images are optional; add them with these names and they appear automatically (a built-in illustration/placeholder is shown until then):
  - `public/onlinesessions/online-session-hero-v2.webp` (1672×941), `online-session-hero-mobile-v2.webp` (1000×1777), `introduction-english-path-gbs.webp` (900×1200)
  - `public/onlinesessions/discover-{english-speaking,schengen,education,living,lifestyle,career}.webp` (900×675)
  - `public/partners/{eie,gbs,english-path,lsc,kensington,sbm}.png` (school logos)

## Calendar ↔ sessions workflow

- **Admin → Calendar**: confirm requested calls (one click = Google event + Meet link + candidate email + WhatsApp), assign advisers, drag booked calls to another day, filters, daily agenda (print/CSV), tasks, overdue alerts, "Rebook requested".
- **Reminders** (`send-reminders`, every 15 min via pg_cron): email 24h and 1h before calls; document-deadline emails (3 days before / due day) after an interviewed session. WhatsApp reminders are automatic only with Twilio secrets; otherwise use "Send reminder" in the presenter queue.
- **Session stats**: Admin → Session stats.

### Connect Google Calendar (one time)
1. Google Cloud Console → create/select a project → **APIs & Services → Library** → enable **Google Calendar API**.
2. **OAuth consent screen**: External, app name "Outreach", add your email as test user (or publish).
3. **Credentials → Create credentials → OAuth client ID → Web application**. Authorized redirect URI:
   `https://qkcdjqrtwzqflrrxdgqw.supabase.co/functions/v1/google-calendar/callback`
4. In Supabase → Edge Functions → Secrets add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Admin → Calendar → **Connect Google Calendar**. The first connected account is the default for candidates' free/busy.
