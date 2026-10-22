-- Document review by admins, and candidate referral links. Additive only.

alter table public.documents
  add column review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  add column review_note text,
  add column reviewed_at timestamptz;

create policy "documents: admin update" on public.documents
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Personal referral code per application; referred applications carry it in tracking.ref
alter table public.consultations
  add column referral_code text unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

create index consultations_tracking_ref_idx on public.consultations ((tracking ->> 'ref'));

-- Friends who applied with my link: first name, date and stage only.
create or replace function public.my_referrals(p_consultation_id uuid)
returns table (first_name text, created_at timestamptz, status text)
language sql stable security definer set search_path = ''
as $$
  select split_part(r.full_name, ' ', 1), r.created_at, r.status
  from public.consultations me
  join public.consultations r on r.tracking ->> 'ref' = me.referral_code and r.id <> me.id
  where me.id = p_consultation_id and public.owns_consultation(p_consultation_id)
  order by r.created_at desc
$$;

revoke all on function public.my_referrals from public, anon;
grant execute on function public.my_referrals to authenticated;
