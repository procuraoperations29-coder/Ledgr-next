-- ─────────────────────────────────────────────────────────────
-- Ledgr · 0015 · Billing status enforcement
--
-- 1) New trials run 7 days (was 14).
-- 2) public.sync_org_billing_status(): lazily flips an org/subscription
--    to 'suspended' once a trial or paid period has lapsed with no
--    successful payment. Called from the app on session load (no cron
--    available), so a stale status self-heals the next time anyone in
--    the org loads a page. Callable by any authenticated user (it only
--    ever tightens access for the org passed in — never grants it).
-- ─────────────────────────────────────────────────────────────

-- ── 1) Shorten the trial for newly-provisioned orgs ───────────
create or replace function public.ensure_subscription(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app
as $$
declare
  v_sub  uuid;
  v_plan uuid;
begin
  if not app.has_org_role(p_org, array['owner','admin']) then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  select id into v_sub from public.subscriptions where organization_id = p_org;
  if v_sub is not null then
    return v_sub;
  end if;

  select id into v_plan from public.plans where code = 'standard' limit 1;

  insert into public.subscriptions
    (organization_id, plan_id, status, trial_ends_at,
     current_period_start, current_period_end)
  values
    (p_org, v_plan, 'trial', now() + interval '7 days',
     now(), now() + interval '7 days')
  returning id into v_sub;

  return v_sub;
end;
$$;

-- ── 2) Lazily suspend orgs that haven't paid ──────────────────
create or replace function public.sync_org_billing_status(p_org uuid)
returns public.org_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub    record;
  v_status public.org_status;
begin
  select status, trial_ends_at, current_period_end
    into v_sub
    from public.subscriptions
   where organization_id = p_org;

  -- No subscription row yet, or org already locked/closed — nothing to do.
  if v_sub is null then
    select status into v_status from public.organizations where id = p_org;
    return v_status;
  end if;

  select status into v_status from public.organizations where id = p_org;
  if v_status in ('suspended', 'cancelled') then
    return v_status;
  end if;

  -- Trial ran out and nobody paid.
  if v_sub.status = 'trial'
     and v_sub.trial_ends_at is not null
     and v_sub.trial_ends_at < now() then
    update public.subscriptions
       set status = 'past_due'
     where organization_id = p_org;
    update public.organizations
       set status = 'suspended'
     where id = p_org;
    return 'suspended';
  end if;

  -- Paid period ran out with no renewal (missed/failed payment).
  if v_sub.status = 'active'
     and v_sub.current_period_end is not null
     and v_sub.current_period_end < now() then
    update public.subscriptions
       set status = 'past_due'
     where organization_id = p_org;
    update public.organizations
       set status = 'suspended'
     where id = p_org;
    return 'suspended';
  end if;

  return v_status;
end;
$$;

grant execute on function public.sync_org_billing_status(uuid) to authenticated;
