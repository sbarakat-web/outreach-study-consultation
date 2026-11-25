-- Personal one-click sign-in links for team members (e.g. /loginnikki#k=…).
-- Only the SHA-256 of the key is stored; the key itself lives only in the link.
-- Read/written only by the presenter-link edge function (service role); no client access.
create table if not exists public.presenter_links (
  key_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
alter table public.presenter_links enable row level security;
-- To revoke a lost link: update public.presenter_links set revoked_at = now() where email = '…';
