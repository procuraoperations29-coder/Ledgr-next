-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0013 · Harden notifications updates (security review)
--
-- The previous notifications_update policy let a member UPDATE any column of a
-- notification in their org (content tampering within the org). Replace it with
-- a SECURITY DEFINER RPC that only ever sets read_at, matching the app's
-- "all writes go through RPC" pattern. Clients can no longer update the table
-- directly.
-- ─────────────────────────────────────────────────────────────

drop policy if exists notifications_update on public.notifications;

create or replace function public.mark_notifications_read(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
begin
  if p_org not in (select app.current_member_org_ids()) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  update public.notifications
    set read_at = now()
    where organization_id = p_org
      and (user_id = auth.uid() or user_id is null)
      and read_at is null;
end;
$$;

grant execute on function public.mark_notifications_read(uuid) to authenticated;
