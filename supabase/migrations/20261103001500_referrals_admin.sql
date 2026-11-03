-- Phase 18: Super Admin tools for the referral programme.
create or replace function public.reject_referral(p_referral uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r referrals;
begin
  if not has_role('super_admin') then raise exception 'Only the Super Admin can reject referrals' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update referrals set status = 'rejected' where id = p_referral and status <> 'rejected' returning * into r;
  if not found then raise exception 'Referral not found or already rejected'; end if;
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'reject_referral', 'referrals', p_referral::text, jsonb_build_object('reason', p_reason, 'referrer', r.referrer_id, 'referee', r.referee_id));
end $$;

-- Referrals with names and the friend's order count, for review (Super Admin only).
create or replace function public.admin_referrals(p_limit int default 200)
returns table (id uuid, status text, created_at timestamptz, qualified_at timestamptz,
               referrer_name text, referrer_phone text, referee_name text, referee_phone text,
               referee_orders int, same_phone boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('super_admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
  select r.id, r.status, r.created_at, r.qualified_at,
         a.full_name, a.phone, b.full_name, b.phone,
         (select count(*)::int from orders o where o.user_id = r.referee_id and o.status <> 'cancelled'),
         a.phone is not null and a.phone = b.phone
  from referrals r join profiles a on a.id = r.referrer_id join profiles b on b.id = r.referee_id
  order by r.created_at desc limit least(p_limit, 500);
end $$;
