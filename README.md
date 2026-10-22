# Consultation app — consultation.outreachrecruitment.eu

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
3. **Auth → URL Configuration**: set Site URL to `https://consultation.outreachrecruitment.eu` and add these redirect URLs:
   `https://consultation.outreachrecruitment.eu/**` and `http://localhost:5173/**`.
4. **Make yourself the first admin.** In the SQL editor:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
   Then create an account at `/login` with that email and confirm it. Add other admins from `/admin/team`.
5. Optional: set Supabase Auth to send email through your own SMTP (Auth → SMTP) so that sign-up emails come from your domain.

## 2. Confirmation emails / WhatsApp (Edge Function)

Create a [Resend](https://resend.com) account, verify `outreachrecruitment.eu`, then run:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  MAIL_FROM="Outreach Recruitment <hello@outreachrecruitment.eu>" \
  ADMIN_NOTIFY_EMAIL=you@example.com \
  APP_URL=https://consultation.outreachrecruitment.eu
supabase functions deploy send-confirmation --no-verify-jwt
```

WhatsApp messages are sent through Twilio, and only if these secrets are set: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (e.g. `+14155238886`). For production, WhatsApp requires an approved sender and message template. Without Twilio, candidates still get the email and a "Chat on WhatsApp" button (`VITE_WHATSAPP_NUMBER`).

## 3. Run locally

```bash
cp .env.example .env    # fill in URL, anon/publishable key, WhatsApp number
npm install
npm run dev             # http://localhost:5173
```

## 4. Deploy to consultation.outreachrecruitment.eu

The app is a static site (`npm run build` → `dist/`). SPA rewrites are already included for Vercel (`vercel.json`) and Netlify (`public/_redirects`).

**Vercel** (example): import the GitHub repo, set **Root Directory** to `consultation-app`, add the three `VITE_*` env vars, and deploy. Then go to Settings → Domains, add `consultation.outreachrecruitment.eu`, and create the DNS record Vercel shows you at your domain registrar (usually `CNAME consultation → cname.vercel-dns.com`).

## Test checklist

- [ ] As a visitor, complete all 5 steps and pick a slot → success screen; the slot disappears for other visitors
- [ ] Confirmation email arrives (candidate + admin)
- [ ] Click the confirmation link → `/dashboard` shows the request and the booked time; uploading a PDF works
- [ ] A second account can't see the first account's requests or documents
- [ ] As an admin: change status and notes, open a document, free a slot, add/delete slots, add an admin
- [ ] A non-admin who opens `/admin` is redirected to `/dashboard`
