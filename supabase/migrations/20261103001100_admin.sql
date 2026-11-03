-- Phase 10-14: helpers for the staff panel.

-- Delivery partners, for Operations to assign orders (staff_roles itself is Super Admin only).
create or replace function public.list_delivery_staff()
returns table (id uuid, full_name text, phone text, active_orders int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select p.id, p.full_name, p.phone,
      (select count(*)::int from delivery_assignments a join orders o on o.id = a.order_id
       where a.staff_id = p.id and a.is_active and o.status not in ('delivered', 'cancelled', 'refunded', 'returned'))
    from staff_roles r join profiles p on p.id = r.user_id
    where r.role = 'delivery'
    order by p.full_name;
end $$;
revoke execute on function public.list_delivery_staff() from public, anon;
grant execute on function public.list_delivery_staff() to authenticated;

-- Everyone with a staff role, for the Super Admin's staff page.
create or replace function public.list_staff()
returns table (id uuid, full_name text, email text, phone text, roles text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role('super_admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select p.id, p.full_name, p.email, p.phone, array_agg(r.role::text order by r.role)
    from staff_roles r join profiles p on p.id = r.user_id
    group by p.id order by p.full_name;
end $$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;
