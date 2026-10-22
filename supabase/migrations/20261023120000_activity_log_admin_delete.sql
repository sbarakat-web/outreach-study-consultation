-- Admins can undo "hidden from presenter queue" (and other log entries).
create policy "activity_log: admins remove" on public.activity_log
  for delete to authenticated using (public.is_admin());
