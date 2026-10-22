# Outreach consultation app

Booking app for consultation.outreachstudy.eu (Vite + React + Tailwind + Supabase). See README.md for setup.

- GitHub: https://github.com/sbarakat-web/outreach-study-consultation (`main`)
- Vercel deploys `main` automatically to consultation.outreachstudy.eu
- Supabase project: `qkcdjqrtwzqflrrxdgqw` (project-scoped MCP server in `.mcp.json`)

## Ship every change automatically

The owner has given standing permission: every completed change must reach GitHub (and so Vercel) right away, without asking first.

1. Before editing: `git fetch origin` and `git pull --ff-only origin main` if behind.
2. After each change: `npm run build` must pass. Review `git status` and the diff, then
   `git add -A && git commit -m "…" && git push origin main`.
3. Never push a broken build, never force-push or rewrite history, and never commit `.env`.
4. Database changes: add a new file in `supabase/migrations/`, apply it to the Supabase project, run the security advisor, then commit it along with the code that uses it.
5. Edge function changes: redeploy `send-confirmation` (verify_jwt off) after committing.
6. After pushing, tell the user it's live on Vercel within about a minute.
